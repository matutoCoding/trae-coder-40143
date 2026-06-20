import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  DatePicker,
  Tag,
  Button,
  Modal,
  Form,
  Select,
  Input,
  message,
  Space,
  Popconfirm,
  Badge,
} from 'antd';
import { PlusOutlined, CheckOutlined, LogoutOutlined, CloseOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  BOOKING_STATUS_LABELS,
  BOOKING_STATUS_COLORS,
  ROOM_TYPE_LABELS,
  type Room,
  type Booking,
  type Family,
  type Pet,
} from '../types';

const { RangePicker } = DatePicker;
const { TextArea } = Input;

function SchedulePage() {
  const [rooms, setRooms] = useState<any[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().startOf('day'),
    dayjs().add(7, 'day').endOf('day'),
  ]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionBooking, setActionBooking] = useState<Booking | null>(null);
  const [actionType, setActionType] = useState<'checkin' | 'checkout' | 'cancel'>('checkin');
  const [form] = Form.useForm();

  const loadData = async () => {
    try {
      const [startDate, endDate] = dateRange;
      const schedule = await window.api.rooms.getSchedule(
        startDate.format('YYYY-MM-DD'),
        endDate.format('YYYY-MM-DD')
      );
      setRooms(schedule);
      const allBookings = await window.api.bookings.list();
      setBookings(allBookings);
      const fams = await window.api.families.list();
      setFamilies(fams);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, [dateRange]);

  const handleOpenBooking = (room: Room) => {
    setSelectedRoom(room);
    form.resetFields();
    setModalOpen(true);
  };

  const handleFamilyChange = async (familyId: string) => {
    try {
      const familyPets = await window.api.pets.listByFamily(familyId);
      setPets(familyPets);
      form.setFieldsValue({ pet_id: undefined });
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmitBooking = async () => {
    try {
      const values = await form.validateFields();
      if (!selectedRoom) return;
      const [start, end] = values.date_range;
      const days = end.diff(start, 'day') + 1;
      await window.api.bookings.create({
        family_id: values.family_id,
        pet_id: values.pet_id,
        room_id: selectedRoom.id,
        start_date: start.format('YYYY-MM-DD'),
        end_date: end.format('YYYY-MM-DD'),
        notes: values.notes,
      });
      message.success(`预订成功！扣减共享额度 ${days} 天`);
      setModalOpen(false);
      loadData();
    } catch (e: any) {
      message.error(e.message || '预订失败');
    }
  };

  const handleAction = (booking: Booking, type: 'checkin' | 'checkout' | 'cancel') => {
    setActionBooking(booking);
    setActionType(type);
    setActionModalOpen(true);
  };

  const confirmAction = async () => {
    if (!actionBooking) return;
    try {
      if (actionType === 'checkin') {
        await window.api.bookings.checkin(actionBooking.id);
        message.success('入住登记成功');
      } else if (actionType === 'checkout') {
        await window.api.bookings.checkout(actionBooking.id);
        message.success('退房成功，额度已释放，候补队列已自动补位');
      } else {
        await window.api.bookings.cancel(actionBooking.id);
        message.success('取消成功，额度已退还，候补队列已自动补位');
      }
      setActionModalOpen(false);
      loadData();
    } catch (e: any) {
      message.error(e.message || '操作失败');
    }
  };

  const renderActions = (booking: Booking) => {
    const actions: React.ReactNode[] = [];
    if (booking.status === 'pending') {
      actions.push(
        <Button type="link" size="small" icon={<CheckOutlined />} onClick={() => handleAction(booking, 'checkin')}>
          入住
        </Button>
      );
      actions.push(
        <Popconfirm title="确认取消预订？" onConfirm={() => handleAction(booking, 'cancel')}>
          <Button type="link" size="small" danger icon={<CloseOutlined />}>
            取消
          </Button>
        </Popconfirm>
      );
    }
    if (booking.status === 'checked_in') {
      actions.push(
        <Button type="link" size="small" icon={<LogoutOutlined />} onClick={() => handleAction(booking, 'checkout')}>
          退房
        </Button>
      );
    }
    return <Space>{actions}</Space>;
  };

  const getCapacityInfo = (room: any) => {
    const cap = room.capacity || 1;
    const used = room.bookings.length;
    if (cap === 1) {
      return used > 0
        ? { text: '已占', color: '#ff4d4f' as const }
        : { text: '空闲', color: '#52c41a' as const };
    }
    if (used >= cap) {
      return { text: `${used}/${cap} 已满`, color: '#ff4d4f' as const };
    }
    return { text: `${used}/${cap} 已占`, color: used > 0 ? '#faad14' as const : '#52c41a' as const };
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 className="page-title" style={{ margin: 0 }}>房间排期</h2>
        <Space>
          <RangePicker
            value={dateRange}
            onChange={(v) => v && setDateRange(v as [dayjs.Dayjs, dayjs.Dayjs])}
            allowClear={false}
          />
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        {rooms.map((room) => {
          const capInfo = getCapacityInfo(room);
          const isFull = room.capacity > 1
            ? room.bookings.length >= room.capacity
            : room.bookings.length > 0;
          return (
            <Col xs={24} md={12} lg={8} xl={6} key={room.id}>
              <Card
                size="small"
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>
                      {room.name}
                      <Tag style={{ marginLeft: 8 }} color="blue">
                        {ROOM_TYPE_LABELS[room.type] || room.type}
                      </Tag>
                    </span>
                    <Tag color={capInfo.color}>{capInfo.text}</Tag>
                  </div>
                }
                extra={
                  room.status === 'active' ? (
                    <Button
                      type="primary"
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() => handleOpenBooking(room)}
                      disabled={isFull}
                    >
                      {isFull ? '已满' : '预订'}
                    </Button>
                  ) : (
                    <Tag color="default">停用</Tag>
                  )
                }
              >
                <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 8 }}>
                  容纳 {room.capacity} 只 · ¥{room.price_per_day}/天
                  {room.capacity > 1 && (
                    <span style={{ marginLeft: 8 }}>
                      （剩余 {Math.max(0, room.capacity - room.bookings.length)} 个位置）
                    </span>
                  )}
                  {room.description && <div>{room.description}</div>}
                </div>
                {room.bookings.length === 0 ? (
                  <div className="empty-tip" style={{ padding: '16px 0' }}>空闲中</div>
                ) : (
                  <div>
                    {room.bookings.map((b: Booking) => (
                      <div
                        key={b.id}
                        className={`booking-tag ${b.status}`}
                        style={{ display: 'block', marginBottom: 6 }}
                        title={`${b.pet_name} · ${b.family_name}`}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>
                            🐾 {b.pet_name} · {b.family_name}
                            <Tag color={BOOKING_STATUS_COLORS[b.status]} style={{ marginLeft: 6 }}>
                              {BOOKING_STATUS_LABELS[b.status]}
                            </Tag>
                          </span>
                        </div>
                        <div style={{ fontSize: 11, marginTop: 4, color: '#595959' }}>
                          {b.start_date} ~ {b.end_date}
                          {b.status === 'pending' && (
                            <span style={{ marginLeft: 8, color: '#d46b08' }}>
                              ⏰ 截止 {dayjs(b.deadline).format('MM-DD HH:mm')}
                            </span>
                          )}
                        </div>
                        {renderActions(b)}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </Col>
          );
        })}
      </Row>

      <Modal
        title={`预订：${selectedRoom?.name || ''}`}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmitBooking}
        okText="确认预订"
        cancelText="取消"
        width={500}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="选择家庭"
            name="family_id"
            rules={[{ required: true, message: '请选择家庭' }]}
          >
            <Select placeholder="请选择家庭" onChange={handleFamilyChange} showSearch optionFilterProp="children">
              {families.map((f) => (
                <Select.Option key={f.id} value={f.id}>
                  {f.name} - {f.contact_person} ({f.phone})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="选择宠物" name="pet_id" rules={[{ required: true, message: '请选择宠物' }]}>
            <Select placeholder="请先选择家庭" disabled={pets.length === 0}>
              {pets.map((p) => (
                <Select.Option key={p.id} value={p.id}>
                  {p.name} ({p.species} · {p.breed || '未知品种'})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label="寄养日期"
            name="date_range"
            rules={[{ required: true, message: '请选择寄养日期' }]}
          >
            <RangePicker
              style={{ width: '100%' }}
              disabledDate={(d) => d && d.isBefore(dayjs().startOf('day'))}
            />
          </Form.Item>
          <Form.Item label="备注" name="notes">
            <TextArea rows={2} placeholder="特殊要求等" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          actionType === 'checkin' ? '确认入住' : actionType === 'checkout' ? '确认退房' : '确认取消预订'
        }
        open={actionModalOpen}
        onCancel={() => setActionModalOpen(false)}
        onOk={confirmAction}
        okText="确认"
        cancelText="取消"
        okButtonProps={{ danger: actionType === 'cancel' }}
      >
        <p>
          宠物：<strong>{actionBooking?.pet_name}</strong>
        </p>
        <p>
          家庭：<strong>{actionBooking?.family_name}</strong>
        </p>
        <p>
          日期：<strong>{actionBooking?.start_date} ~ {actionBooking?.end_date}</strong>
        </p>
        {actionType === 'cancel' && (
          <p style={{ color: '#faad14' }}>取消后将自动退还共享额度并通知候补队列补位</p>
        )}
        {actionType === 'checkout' && (
          <p style={{ color: '#52c41a' }}>退房后将释放额度并通知候补队列补位</p>
        )}
      </Modal>
    </div>
  );
}

export default SchedulePage;
