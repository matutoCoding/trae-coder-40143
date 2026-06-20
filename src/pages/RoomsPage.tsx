import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, InputNumber, message, Space, Tag, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { ROOM_TYPE_LABELS, type Room } from '../types';

function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);
  const [form] = Form.useForm();

  const loadRooms = async () => {
    try {
      const data = await window.api.rooms.list();
      setRooms(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadRooms();
  }, []);

  const handleAdd = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (room: Room) => {
    setEditing(room);
    form.setFieldsValue({
      name: room.name,
      type: room.type,
      capacity: room.capacity,
      description: room.description,
      price_per_day: room.price_per_day,
      status: room.status,
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await window.api.rooms.delete(id);
      message.success('已停用');
      loadRooms();
    } catch (e: any) {
      message.error(e.message || '操作失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editing) {
        await window.api.rooms.update(editing.id, values);
        message.success('更新成功');
      } else {
        await window.api.rooms.create(values);
        message.success('创建成功');
      }
      setModalOpen(false);
      loadRooms();
    } catch (e: any) {
      message.error(e.message || '保存失败');
    }
  };

  const columns = [
    { title: '房间名称', dataIndex: 'name', key: 'name' },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (t: string) => <Tag color="blue">{ROOM_TYPE_LABELS[t] || t}</Tag>,
    },
    { title: '容量', dataIndex: 'capacity', key: 'capacity', width: 80 },
    { title: '价格(元/天)', dataIndex: 'price_per_day', key: 'price_per_day', width: 120 },
    { title: '描述', dataIndex: 'description', key: 'description' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: string) => (
        <Tag color={s === 'active' ? 'green' : 'default'}>{s === 'active' ? '启用' : '停用'}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_: any, record: Room) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          {record.status === 'active' && (
            <Popconfirm title="确认停用该房间？" onConfirm={() => handleDelete(record.id)}>
              <Button size="small" danger icon={<DeleteOutlined />}>
                停用
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 className="page-title" style={{ margin: 0 }}>宠物间管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新建宠物间
        </Button>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={rooms}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editing ? '编辑宠物间' : '新建宠物间'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item label="房间名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="如：豪华单间A" />
          </Form.Item>
          <Form.Item label="房间类型" name="type" rules={[{ required: true, message: '请选择类型' }]}>
            <Select placeholder="请选择">
              <Select.Option value="luxury">豪华间</Select.Option>
              <Select.Option value="standard">标准间</Select.Option>
              <Select.Option value="family">家庭套房</Select.Option>
              <Select.Option value="cat">猫咪专属</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item label="可容纳宠物数" name="capacity" rules={[{ required: true, message: '请输入数量' }]}>
            <InputNumber min={1} max={10} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="每日价格(元)" name="price_per_day" rules={[{ required: true, message: '请输入价格' }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={2} placeholder="设施描述等" />
          </Form.Item>
          {editing && (
            <Form.Item label="状态" name="status" initialValue="active">
              <Select>
                <Select.Option value="active">启用</Select.Option>
                <Select.Option value="inactive">停用</Select.Option>
              </Select>
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
}

export default RoomsPage;
