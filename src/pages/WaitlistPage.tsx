import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Select,
  DatePicker,
  Input,
  message,
  Space,
  Tag,
  Popconfirm,
  Tabs,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { ROOM_TYPE_LABELS, type WaitlistEntry, type WaitlistConfirmation, type Family, type Pet } from '../types';

const { RangePicker } = DatePicker;
const { TextArea } = Input;

const WAITLIST_STATUS_COLORS: Record<string, string> = {
  waiting: 'blue',
  notified: 'orange',
  confirmed: 'green',
  cancelled: 'default',
};

const WAITLIST_STATUS_LABELS: Record<string, string> = {
  waiting: '等待中',
  notified: '已通知',
  confirmed: '已确认',
  cancelled: '已取消',
};

const CONFIRMATION_STATUS_COLORS: Record<string, string> = {
  pending: 'orange',
  confirmed: 'green',
  declined: 'red',
  expired: 'gray',
};

const CONFIRMATION_STATUS_LABELS: Record<string, string> = {
  pending: '待确认',
  confirmed: '已确认',
  declined: '已放弃',
  expired: '已过期',
};

function formatCountdown(deadline: string) {
  const now = dayjs();
  const end = dayjs(deadline);
  const diff = end.diff(now);
  if (diff <= 0) return '已过期';
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    const remainHours = hours % 24;
    return `${days}天${remainHours}小时`;
  }
  return `${hours}小时${minutes}分钟`;
}

function WaitlistPage() {
  const [activeTab, setActiveTab] = useState('queue');
  const [list, setList] = useState<WaitlistEntry[]>([]);
  const [confirmations, setConfirmations] = useState<WaitlistConfirmation[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const loadWaitlist = async () => {
    try {
      const [waitlist, fams] = await Promise.all([
        window.api.waitlist.list(),
        window.api.families.list(),
      ]);
      setList(waitlist);
      setFamilies(fams);
    } catch (e) {
      console.error(e);
    }
  };

  const loadConfirmations = async () => {
    try {
      const data = await window.api.waitlist.listConfirmations();
      setConfirmations(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadWaitlist();
    loadConfirmations();
  }, []);

  useEffect(() => {
    if (activeTab !== 'confirmation') return;
    const timer = setInterval(() => {
      setConfirmations((prev) => [...prev]);
    }, 60000);
    return () => clearInterval(timer);
  }, [activeTab]);

  const handleFamilyChange = async (familyId: string) => {
    try {
      const familyPets = await window.api.pets.listByFamily(familyId);
      setPets(familyPets);
      form.setFieldsValue({ pet_id: undefined });
    } catch (e) {
      console.error(e);
    }
  };

  const handleAdd = () => {
    form.resetFields();
    setPets([]);
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const [start, end] = values.date_range;
      await window.api.waitlist.add({
        family_id: values.family_id,
        pet_id: values.pet_id,
        room_type: values.room_type,
        start_date: start.format('YYYY-MM-DD'),
        end_date: end.format('YYYY-MM-DD'),
        notes: values.notes,
      });
      message.success('已加入候补队列');
      setModalOpen(false);
      loadWaitlist();
    } catch (e: any) {
      message.error(e.message || '操作失败');
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await window.api.waitlist.remove(id);
      message.success('已从候补队列移除');
      loadWaitlist();
    } catch (e: any) {
      message.error(e.message || '操作失败');
    }
  };

  const handleConfirm = async (id: string) => {
    try {
      await window.api.waitlist.confirm(id);
      message.success('已确认补位');
      loadConfirmations();
      loadWaitlist();
    } catch (e: any) {
      message.error(e.message || '操作失败');
    }
  };

  const handleDecline = async (id: string) => {
    try {
      await window.api.waitlist.decline(id);
      message.success('已放弃补位');
      loadConfirmations();
      loadWaitlist();
    } catch (e: any) {
      message.error(e.message || '操作失败');
    }
  };

  const waitlistColumns = [
    {
      title: '候补顺位',
      dataIndex: 'position',
      key: 'position',
      width: 90,
      render: (p: number, r: WaitlistEntry) => (
        <Tag color={p === 1 ? 'gold' : 'default'}>
          {p === 1 ? '🥇 第1位' : `第${p}位`}
        </Tag>
      ),
    },
    { title: '宠物', dataIndex: 'pet_name', key: 'pet_name' },
    { title: '家庭', dataIndex: 'family_name', key: 'family_name' },
    {
      title: '房间类型',
      dataIndex: 'room_type',
      key: 'room_type',
      width: 120,
      render: (t: string) => <Tag color="blue">{ROOM_TYPE_LABELS[t] || t}</Tag>,
    },
    {
      title: '期望日期',
      key: 'dates',
      render: (_: any, r: WaitlistEntry) => (
        <span>
          {r.start_date} ~ {r.end_date}
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={WAITLIST_STATUS_COLORS[status]}>{WAITLIST_STATUS_LABELS[status] || status}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: WaitlistEntry) => (
        <Popconfirm title="确认移出候补队列？" onConfirm={() => handleRemove(record.id)}>
          <Button size="small" danger icon={<DeleteOutlined />}>
            移出
          </Button>
        </Popconfirm>
      ),
    },
  ];

  const groupedByType = list.reduce((acc, item) => {
    if (!acc[item.room_type]) acc[item.room_type] = [];
    acc[item.room_type].push(item);
    return acc;
  }, {} as Record<string, WaitlistEntry[]>);

  const confirmationColumns = [
    { title: '宠物', dataIndex: 'pet_name', key: 'pet_name' },
    { title: '家庭', dataIndex: 'family_name', key: 'family_name' },
    { title: '房间', dataIndex: 'room_name', key: 'room_name' },
    {
      title: '入住日期',
      key: 'dates',
      render: (_: any, r: WaitlistConfirmation) => (
        <span>
          {r.start_date} ~ {r.end_date}
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={CONFIRMATION_STATUS_COLORS[status]}>{CONFIRMATION_STATUS_LABELS[status] || status}</Tag>
      ),
    },
    {
      title: '确认截止',
      key: 'confirm_deadline',
      width: 180,
      render: (_: any, r: WaitlistConfirmation) => {
        if (r.status !== 'pending') {
          return <span style={{ color: '#999' }}>{dayjs(r.confirm_deadline).format('YYYY-MM-DD HH:mm')}</span>;
        }
        const now = dayjs();
        const deadline = dayjs(r.confirm_deadline);
        const isExpired = deadline.isBefore(now);
        return (
          <div>
            <div>{dayjs(r.confirm_deadline).format('YYYY-MM-DD HH:mm')}</div>
            {isExpired ? (
              <Tag color="red">已过期</Tag>
            ) : (
              <Tag color="volcano">{formatCountdown(r.confirm_deadline)}后截止</Tag>
            )}
          </div>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_: any, record: WaitlistConfirmation) => {
        if (record.status !== 'pending') return null;
        return (
          <Space>
            <Popconfirm title="确认接受补位？" onConfirm={() => handleConfirm(record.id)}>
              <Button size="small" type="primary" style={{ background: '#52c41a', borderColor: '#52c41a' }}>
                确认
              </Button>
            </Popconfirm>
            <Popconfirm title="确认放弃补位？" onConfirm={() => handleDecline(record.id)}>
              <Button size="small" danger>
                放弃
              </Button>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 className="page-title" style={{ margin: 0 }}>候补补位队列</h2>
        {activeTab === 'queue' && (
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加候补
          </Button>
        )}
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'queue',
            label: '候补队列',
            children: (
              <>
                <div style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {Object.keys(ROOM_TYPE_LABELS).map((type) => (
                    <Tag key={type} color="blue" style={{ padding: '4px 12px', fontSize: 14 }}>
                      {ROOM_TYPE_LABELS[type]}：{groupedByType[type]?.length || 0} 人
                    </Tag>
                  ))}
                </div>
                <Table rowKey="id" columns={waitlistColumns} dataSource={list} pagination={{ pageSize: 10 }} />
              </>
            ),
          },
          {
            key: 'confirmation',
            label: '补位确认',
            children: (
              <Table
                rowKey="id"
                columns={confirmationColumns}
                dataSource={confirmations}
                pagination={{ pageSize: 10 }}
              />
            ),
          },
        ]}
      />

      <Modal
        title="添加候补"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        okText="加入候补"
        cancelText="取消"
        width={500}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="房间类型" name="room_type" rules={[{ required: true, message: '请选择' }]}>
            <Select placeholder="请选择期望的房间类型">
              <Select.Option value="luxury">豪华间</Select.Option>
              <Select.Option value="standard">标准间</Select.Option>
              <Select.Option value="family">家庭套房</Select.Option>
              <Select.Option value="cat">猫咪专属</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item label="家庭" name="family_id" rules={[{ required: true, message: '请选择' }]}>
            <Select placeholder="请选择家庭" onChange={handleFamilyChange} showSearch optionFilterProp="children">
              {families.map((f) => (
                <Select.Option key={f.id} value={f.id}>
                  {f.name} - {f.contact_person}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="宠物" name="pet_id" rules={[{ required: true, message: '请选择' }]}>
            <Select placeholder="请先选择家庭" disabled={pets.length === 0}>
              {pets.map((p) => (
                <Select.Option key={p.id} value={p.id}>
                  {p.name} ({p.species})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="期望日期" name="date_range" rules={[{ required: true, message: '请选择' }]}>
            <RangePicker style={{ width: '100%' }} disabledDate={(d) => d && d.isBefore(dayjs().startOf('day'))} />
          </Form.Item>
          <Form.Item label="备注" name="notes">
            <TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default WaitlistPage;
