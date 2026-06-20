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
  Descriptions,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { ROOM_TYPE_LABELS, type WaitlistEntry, type Family, type Pet } from '../types';

const { RangePicker } = DatePicker;
const { TextArea } = Input;

function WaitlistPage() {
  const [list, setList] = useState<WaitlistEntry[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const loadData = async () => {
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

  useEffect(() => {
    loadData();
  }, []);

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
      loadData();
    } catch (e: any) {
      message.error(e.message || '操作失败');
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await window.api.waitlist.remove(id);
      message.success('已从候补队列移除');
      loadData();
    } catch (e: any) {
      message.error(e.message || '操作失败');
    }
  };

  const columns = [
    {
      title: '候补顺位',
      dataIndex: 'position',
      key: 'position',
      width: 90,
      render: (p: number, r: WaitlistEntry) => (
        <Tag color={p === 1 ? 'gold' : 'default'}>
          {p === 1 ? '🥇 第1位' : `第${p}位`}
          {r.status === 'notified' && <Tag color="blue">已通知</Tag>}
        </Tag>
      ),
    },
    {
      title: '房间类型',
      dataIndex: 'room_type',
      key: 'room_type',
      width: 120,
      render: (t: string) => <Tag color="blue">{ROOM_TYPE_LABELS[t] || t}</Tag>,
    },
    { title: '宠物', dataIndex: 'pet_name', key: 'pet_name' },
    { title: '家庭', dataIndex: 'family_name', key: 'family_name' },
    { title: '联系人', dataIndex: 'contact_person', key: 'contact_person', width: 100 },
    { title: '电话', dataIndex: 'phone', key: 'phone', width: 130 },
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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 className="page-title" style={{ margin: 0 }}>候补补位队列</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          添加候补
        </Button>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {Object.keys(ROOM_TYPE_LABELS).map((type) => (
          <Tag key={type} color="blue" style={{ padding: '4px 12px', fontSize: 14 }}>
            {ROOM_TYPE_LABELS[type]}：{groupedByType[type]?.length || 0} 人
          </Tag>
        ))}
      </div>

      <Table rowKey="id" columns={columns} dataSource={list} pagination={{ pageSize: 10 }} />

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
