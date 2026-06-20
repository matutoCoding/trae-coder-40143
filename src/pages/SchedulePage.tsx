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
  Segmented,
} from 'antd';
import { PlusOutlined, CheckOutlined, LogoutOutlined, CloseOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  BOOKING_STATUS_LABELS,
  BOOKING_STATUS_COLORS,
  ROOM_TYPE_LABELS,
  type Booking,
  type Family,
  type Pet,
  type WeekScheduleRoom,
  type DailySlots,
} from '../types';

const { RangePicker } = DatePicker;
const { TextArea } = Input;

function SchedulePage() {
  const [viewMode, setViewMode] = useState<'card' | 'calendar'>('calendar');
  const [rooms, setRooms] = useState<any[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().startOf('day'),
    dayjs().add(7, 'day').endOf('day'),
  ]);
  const [weekStart, setWeekStart] = useState(dayjs().startOf('week'));
  const [weekData, setWeekData] = useState<{ days: string[]; rooms: WeekScheduleRoom[] } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [dailySlots, setDailySlots] = useState<DailySlots | null>(null);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionBooking, setActionBooking] = useState<Booking | null>(null);
  const [actionType, setActionType] = useState<'checkin' | 'checkout' | 'cancel'>('checkin');
  const [form] = Form.useForm();

  const CLEANING_STATUS_LABELS: Record<string, { label: string; color: string }> = {
    pending: { label: '待清洁', color: 'orange' },
    in_progress: { label: '清洁中', color: 'blue' },
    overdue: { label: '清洁超时', color: 'red' },
  };

  const loadCardData = async () => {
    try {
      const dateStr = selectedDate.format('YYYY-MM-DD');
      const schedule = await window.api.rooms.getDaySchedule(dateStr);
      setRooms(schedule);
      const fams = await window.api.families.list();
      setFamilies(fams);
    } catch (e) {
      console.error(e);
    }
  };

  const loadWeekData = async () => {
    try {
      const data = await window.api.rooms.getWeekSchedule(weekStart.format('YYYY-MM-DD'));
      setWeekData(data);
      const fams = await window.api.families.list();
      setFamilies(fams);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (viewMode === 'card') loadCardData();
    else loadWeekData();
  }, [viewMode, selectedDate, weekStart]);

  const handleOpenBooking = (room: any, date?: string) => {
    const cs = room.cleaning_status;
    if (cs && ['pending', 'in_progress', 'overdue'].includes(cs)) {
      const label = CLEANING_STATUS_LABELS[cs];
      message.warning(`房间正在${label?.label || '清洁中'}，暂时无法预订`);
      return;
    }
    setSelectedRoom(room);
    form.resetFields();
    if (date) {
      form.setFieldsValue({
        date_range: [dayjs(date), dayjs(date)] as any,
      });
    }
    setModalOpen(true);
    if (room.capacity > 1 || room.room_capacity > 1) {
      loadDailySlots(room.id || room.room_id);
    }
  };

  const loadDailySlots = async (roomId: string) => {
    try {
      const dateRangeVal = form.getFieldValue('date_range');
      if (!dateRangeVal) return;
      const [start, end] = dateRangeVal;
      const slots = await window.api.rooms.getDailySlots(
        roomId,
        start.format('YYYY-MM-DD'),
        end.format('YYYY-MM-DD')
      );
      setDailySlots(slots);
    } catch (e) {
      console.error(e);
    }
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

  const handleDateRangeChange = async () => {
    if (selectedRoom && selectedRoom.capacity > 1) {
      setTimeout(() => loadDailySlots(selectedRoom.id), 100);
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
        room_id: selectedRoom.id || selectedRoom.room_id,
        start_date: start.format('YYYY-MM-DD'),
        end_date: end.format('YYYY-MM-DD'),
        notes: values.notes,
      });
      message.success(`预订成功！扣减共享额度 ${days} 天`);
      setModalOpen(false);
      setDailySlots(null);
      if (viewMode === 'card') loadCardData();
      else loadWeekData();
    } catch (e: any) {
      message.error(e.message || '预订失败');
    }
  };

  const handleAction = (booking: any, type: 'checkin' | 'checkout' | 'cancel') => {
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
        message.success('退房成功，额度已释放');
      } else {
        await window.api.bookings.cancel(actionBooking.id);
        message.success('取消成功，额度已退还');
      }
      setActionModalOpen(false);
      if (viewMode === 'card') loadCardData();
      else loadWeekData();
    } catch (e: any) {
      message.error(e.message || '操作失败');
    }
  };

  const renderBookingActions = (booking: any) => {
    const stopBubble = (e: React.MouseEvent) => e.stopPropagation();
    const actions: React.ReactNode[] = [];
    if (booking.status === 'pending') {
      actions.push(
        <Button key="ci" type="link" size="small" icon={<CheckOutlined />} onClick={(e) => { stopBubble(e); handleAction(booking, 'checkin'); }}>入住</Button>,
        <span key="cc" onClick={stopBubble} style={{ display: 'inline-block' }}>
          <Popconfirm title="确认取消？" onConfirm={() => handleAction(booking, 'cancel')}>
            <Button type="link" size="small" danger icon={<CloseOutlined />}>取消</Button>
          </Popconfirm>
        </span>
      );
    }
    if (booking.status === 'checked_in') {
      actions.push(
        <Button key="co" type="link" size="small" icon={<LogoutOutlined />} onClick={(e) => { stopBubble(e); handleAction(booking, 'checkout'); }}>退房</Button>
      );
    }
    return actions.length > 0 ? <Space size={4}>{actions}</Space> : null;
  };

  const weekDayLabels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

  const renderCalendarView = () => {
    if (!weekData) return <div className="empty-tip">加载中...</div>;
    const { days, rooms: weekRooms } = weekData;
    return (
      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, gap: 16 }}>
          <Button icon={<LeftOutlined />} onClick={() => setWeekStart(weekStart.subtract(7, 'day'))} />
          <span style={{ fontSize: 16, fontWeight: 600 }}>
            {weekStart.format('YYYY/MM/DD')} - {weekStart.add(6, 'day').format('YYYY/MM/DD')}
          </span>
          <Button icon={<RightOutlined />} onClick={() => setWeekStart(weekStart.add(7, 'day'))} />
          <Button onClick={() => setWeekStart(dayjs().startOf('week'))}>本周</Button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
          <thead>
            <tr>
              <th style={{ padding: '8px 12px', borderBottom: '2px solid #f0f0f0', textAlign: 'left', width: 140, background: '#fafafa' }}>房间</th>
              {days.map((d, i) => {
                const isToday = d === dayjs().format('YYYY-MM-DD');
                return (
                  <th key={d} style={{ padding: '8px 6px', borderBottom: '2px solid #f0f0f0', textAlign: 'center', background: isToday ? '#e6f7ff' : '#fafafa', minWidth: 100 }}>
                    <div style={{ fontSize: 11, color: '#8c8c8c' }}>{weekDayLabels[i]}</div>
                    <div style={{ fontWeight: isToday ? 700 : 400, color: isToday ? '#1890ff' : undefined }}>{dayjs(d).format('M/D')}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {weekRooms.map((room) => {
              const cs = room.cleaning_status || 'clean';
              const isCleaning = ['pending', 'in_progress', 'overdue'].includes(cs);
              const cleaningMeta = CLEANING_STATUS_LABELS[cs];
              return (
                <tr key={room.room_id}>
                  <td style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0', fontWeight: 500 }}>
                    <div>{room.room_name}</div>
                    <div style={{ fontSize: 11, color: '#8c8c8c' }}>
                      <Tag color="blue" style={{ fontSize: 10 }}>{ROOM_TYPE_LABELS[room.room_type]}</Tag>
                      容纳{room.capacity}
                      {isCleaning && cleaningMeta && (
                        <Tag color={cleaningMeta.color} style={{ fontSize: 10, marginLeft: 4 }}>{cleaningMeta.label}</Tag>
                      )}
                    </div>
                  </td>
                  {days.map((d) => {
                    const dayInfo = room.days[d];
                    const isFull = dayInfo.available === 0 || isCleaning;
                    const isToday = d === dayjs().format('YYYY-MM-DD');
                    return (
                      <td
                        key={d}
                        style={{
                          padding: 4,
                          borderBottom: '1px solid #f0f0f0',
                          background: isCleaning ? '#fff1f0' : isToday ? '#f0f9ff' : undefined,
                          verticalAlign: 'top',
                          cursor: isCleaning ? 'not-allowed' : 'pointer',
                          minWidth: 100,
                          opacity: isCleaning ? 0.6 : 1,
                        }}
                        onClick={() => {
                          if (!isCleaning && !isFull) handleOpenBooking(room, d);
                        }}
                      >
                      <div style={{ textAlign: 'center', marginBottom: 4 }}>
                        {isCleaning && cleaningMeta ? (
                          <Tag color={cleaningMeta.color} style={{ fontSize: 10 }}>{cleaningMeta.label}</Tag>
                        ) : isFull ? (
                          <Tag color="red" style={{ fontSize: 10 }}>已满</Tag>
                        ) : (
                          <Tag color={dayInfo.available < room.capacity ? 'orange' : 'green'} style={{ fontSize: 10 }}>
                            余{dayInfo.available}
                          </Tag>
                        )}
                      </div>
                      {dayInfo.bookings.slice(0, 3).map((b: any) => (
                        <div
                          key={b.id}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            fontSize: 10,
                            padding: '2px 4px',
                            marginBottom: 2,
                            borderRadius: 3,
                            background: b.status === 'checked_in' ? '#f6ffed' : '#fff7e6',
                            border: `1px solid ${b.status === 'checked_in' ? '#b7eb8f' : '#ffd591'}`,
                          }}
                        >
                          <div style={{ fontWeight: 500 }}>🐾 {b.pet_name}</div>
                          <div style={{ color: '#8c8c8c' }}>{b.family_name}</div>
                          {renderBookingActions(b)}
                        </div>
                      ))}
                      {dayInfo.bookings.length > 3 && (
                        <div style={{ fontSize: 10, color: '#8c8c8c', textAlign: 'center' }}>
                          +{dayInfo.bookings.length - 3} 更多
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const getCapacityInfo = (room: any) => {
    const cap = room.capacity || 1;
    const available = room.available != null ? room.available : cap - (room.bookings?.length || 0);
    const occupied = cap - available;
    const isCleaning = ['pending', 'in_progress', 'overdue'].includes(room.cleaning_status);
    if (isCleaning) {
      const meta = CLEANING_STATUS_LABELS[room.cleaning_status];
      return { text: meta?.label || '清洁中', color: meta?.color || 'orange' };
    }
    if (cap === 1) return occupied > 0 ? { text: '已占', color: '#ff4d4f' as const } : { text: '空闲', color: '#52c41a' as const };
    if (available === 0) return { text: `${occupied}/${cap} 已满`, color: '#ff4d4f' as const };
    return { text: `${available}/${cap} 可订`, color: occupied > 0 ? '#faad14' as const : '#52c41a' as const };
  };

  const renderCardView = () => (
    <Row gutter={[16, 16]}>
      {rooms.map((room) => {
        const capInfo = getCapacityInfo(room);
        const isCleaning = ['pending', 'in_progress', 'overdue'].includes(room.cleaning_status);
        const cap = room.capacity || 1;
        const available = room.available != null ? room.available : cap - (room.bookings?.length || 0);
        const isFull = available === 0 || isCleaning;
        return (
          <Col xs={24} md={12} lg={8} xl={6} key={room.room_id || room.id}>
            <Card
              size="small"
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{room.room_name || room.name}<Tag style={{ marginLeft: 8 }} color="blue">{ROOM_TYPE_LABELS[room.room_type || room.type]}</Tag></span>
                  <Tag color={capInfo.color}>{capInfo.text}</Tag>
                </div>
              }
              extra={isCleaning ? (
                <Tag color="red">不可订</Tag>
              ) : room.status === 'active' || !room.status ? (
                <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => handleOpenBooking(room)} disabled={isFull}>
                  {isFull ? '已满' : '预订'}
                </Button>
              ) : <Tag color="default">停用</Tag>}
              style={isCleaning ? { opacity: 0.7, borderLeft: '3px solid #ff4d4f' } : undefined}
            >
              <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 8 }}>
                容纳 {cap} 只 · ¥{room.price_per_day}/天
                {cap > 1 && <span style={{ marginLeft: 8 }}>（剩余 {available} 个位置）</span>}
              </div>
              {!room.bookings?.length ? (
                <div className="empty-tip" style={{ padding: '16px 0' }}>
                  {isCleaning ? '等待清洁完成' : '空闲中'}
                </div>
              ) : (
                room.bookings.map((b: any) => (
                  <div key={b.id} className={`booking-tag ${b.status}`} style={{ display: 'block', marginBottom: 6 }}>
                    <span>🐾 {b.pet_name} · {b.family_name} <Tag color={BOOKING_STATUS_COLORS[b.status]}>{BOOKING_STATUS_LABELS[b.status]}</Tag></span>
                    <div style={{ fontSize: 11, color: '#595959' }}>{b.start_date} ~ {b.end_date}</div>
                    {renderBookingActions(b)}
                  </div>
                ))
              )}
            </Card>
          </Col>
        );
      })}
    </Row>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 className="page-title" style={{ margin: 0 }}>房间排期</h2>
        <Space>
          <Segmented
            value={viewMode}
            onChange={(v) => setViewMode(v as 'card' | 'calendar')}
            options={[
              { label: '日历视图', value: 'calendar' },
              { label: '卡片视图', value: 'card' },
            ]}
          />
          {viewMode === 'card' && (
            <DatePicker
              value={selectedDate}
              onChange={(d) => d && setSelectedDate(d)}
              allowClear={false}
            />
          )}
        </Space>
      </div>

      {viewMode === 'calendar' ? renderCalendarView() : renderCardView()}

      <Modal
        title={`预订：${selectedRoom?.name || selectedRoom?.room_name || ''}`}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setDailySlots(null); }}
        onOk={handleSubmitBooking}
        okText="确认预订"
        cancelText="取消"
        width={560}
      >
        <Form form={form} layout="vertical" onValuesChange={(changed) => {
          if (changed.date_range && selectedRoom && (selectedRoom.capacity > 1 || selectedRoom.room_id)) {
            loadDailySlots(selectedRoom.id || selectedRoom.room_id);
          }
        }}>
          <Form.Item label="选择家庭" name="family_id" rules={[{ required: true, message: '请选择家庭' }]}>
            <Select placeholder="请选择家庭" onChange={handleFamilyChange} showSearch optionFilterProp="children">
              {families.map((f) => (
                <Select.Option key={f.id} value={f.id}>{f.name} - {f.contact_person} ({f.phone})</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="选择宠物" name="pet_id" rules={[{ required: true, message: '请选择宠物' }]}>
            <Select placeholder="请先选择家庭" disabled={pets.length === 0}>
              {pets.map((p) => (
                <Select.Option key={p.id} value={p.id}>{p.name} ({p.species} · {p.breed || '未知品种'})</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="寄养日期" name="date_range" rules={[{ required: true, message: '请选择寄养日期' }]}>
            <RangePicker style={{ width: '100%' }} disabledDate={(d) => d && d.isBefore(dayjs().startOf('day'))} />
          </Form.Item>
          {dailySlots && dailySlots.capacity > 1 && (
            <div style={{ marginBottom: 12, padding: 12, background: '#fafafa', borderRadius: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>每日剩余名额（容量 {dailySlots.capacity}）</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {dailySlots.days.map((d) => (
                  <Tag key={d.date} color={d.isFull ? 'red' : d.available < dailySlots.capacity ? 'orange' : 'green'}>
                    {dayjs(d.date).format('M/D')}: 余{d.available}{d.isFull ? '(满)' : ''}
                  </Tag>
                ))}
              </div>
            </div>
          )}
          <Form.Item label="备注" name="notes">
            <TextArea rows={2} placeholder="特殊要求等" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={actionType === 'checkin' ? '确认入住' : actionType === 'checkout' ? '确认退房' : '确认取消预订'}
        open={actionModalOpen}
        onCancel={() => setActionModalOpen(false)}
        onOk={confirmAction}
        okText="确认"
        cancelText="取消"
        okButtonProps={{ danger: actionType === 'cancel' }}
      >
        <p>宠物：<strong>{actionBooking?.pet_name}</strong></p>
        <p>家庭：<strong>{actionBooking?.family_name}</strong></p>
        <p>日期：<strong>{actionBooking?.start_date} ~ {actionBooking?.end_date}</strong></p>
        {actionType === 'cancel' && <p style={{ color: '#faad14' }}>取消后将退还共享额度并通知候补队列</p>}
        {actionType === 'checkout' && <p style={{ color: '#52c41a' }}>退房后将释放额度并通知候补队列</p>}
      </Modal>
    </div>
  );
}

export default SchedulePage;
