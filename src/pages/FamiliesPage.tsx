import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  message,
  Space,
  Tag,
  Popconfirm,
  Card,
  Row,
  Col,
  Progress,
  Descriptions,
  List,
  Divider,
  Select,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, PlusCircleOutlined, MinusCircleOutlined } from '@ant-design/icons';
import type { Family, Pet, QuotaInfo, QuotaTransaction } from '../types';

function FamiliesPage() {
  const [families, setFamilies] = useState<Family[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Family | null>(null);
  const [form] = Form.useForm();

  const [petsModalOpen, setPetsModalOpen] = useState(false);
  const [selectedFamily, setSelectedFamily] = useState<Family | null>(null);
  const [familyPets, setFamilyPets] = useState<Pet[]>([]);
  const [petForm] = Form.useForm();
  const [editingPet, setEditingPet] = useState<Pet | null>(null);
  const [petModalOpen, setPetModalOpen] = useState(false);

  const [quotaModalOpen, setQuotaModalOpen] = useState(false);
  const [quotaInfo, setQuotaInfo] = useState<QuotaInfo | null>(null);
  const [quotaHistory, setQuotaHistory] = useState<QuotaTransaction[]>([]);

  const loadFamilies = async () => {
    try {
      const data = await window.api.families.list();
      setFamilies(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadFamilies();
  }, []);

  const handleAdd = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (f: Family) => {
    setEditing(f);
    form.setFieldsValue({
      name: f.name,
      contact_person: f.contact_person,
      phone: f.phone,
      address: f.address,
      quota_pool: f.quota_pool,
    });
    setModalOpen(true);
  };

  const handleSubmitFamily = async () => {
    try {
      const values = await form.validateFields();
      if (editing) {
        await window.api.families.update(editing.id, values);
        message.success('更新成功');
      } else {
        await window.api.families.create(values);
        message.success('创建成功');
      }
      setModalOpen(false);
      loadFamilies();
    } catch (e: any) {
      message.error(e.message || '保存失败');
    }
  };

  const handleViewPets = async (f: Family) => {
    setSelectedFamily(f);
    try {
      const pets = await window.api.pets.listByFamily(f.id);
      setFamilyPets(pets);
      setPetsModalOpen(true);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddPet = () => {
    setEditingPet(null);
    petForm.resetFields();
    setPetModalOpen(true);
  };

  const handleEditPet = (p: Pet) => {
    setEditingPet(p);
    petForm.setFieldsValue({
      name: p.name,
      species: p.species,
      breed: p.breed,
      age: p.age,
      weight: p.weight,
      notes: p.notes,
    });
    setPetModalOpen(true);
  };

  const handleDeletePet = async (id: string) => {
    try {
      await window.api.pets.delete(id);
      message.success('已删除');
      if (selectedFamily) {
        const pets = await window.api.pets.listByFamily(selectedFamily.id);
        setFamilyPets(pets);
      }
    } catch (e: any) {
      message.error(e.message || '删除失败');
    }
  };

  const handleSubmitPet = async () => {
    try {
      const values = await petForm.validateFields();
      if (!selectedFamily) return;
      if (editingPet) {
        await window.api.pets.update(editingPet.id, values);
        message.success('更新成功');
      } else {
        await window.api.pets.create({ ...values, family_id: selectedFamily.id });
        message.success('添加成功');
      }
      setPetModalOpen(false);
      const pets = await window.api.pets.listByFamily(selectedFamily.id);
      setFamilyPets(pets);
    } catch (e: any) {
      message.error(e.message || '保存失败');
    }
  };

  const handleViewQuota = async (f: Family) => {
    setSelectedFamily(f);
    try {
      const [info, history] = await Promise.all([
        window.api.families.getQuota(f.id),
        window.api.families.getQuotaHistory(f.id),
      ]);
      setQuotaInfo(info);
      setQuotaHistory(history);
      setQuotaModalOpen(true);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAdjustQuota = async (amount: number) => {
    if (!selectedFamily) return;
    try {
      const reason = amount > 0 ? '管理员充值' : '管理员扣减';
      await window.api.families.adjustQuota(selectedFamily.id, amount, reason);
      message.success(amount > 0 ? `充值 ${amount} 天成功` : `扣减 ${-amount} 天成功`);
      const [info, history] = await Promise.all([
        window.api.families.getQuota(selectedFamily.id),
        window.api.families.getQuotaHistory(selectedFamily.id),
      ]);
      setQuotaInfo(info);
      setQuotaHistory(history);
    } catch (e: any) {
      message.error(e.message || '操作失败');
    }
  };

  const columns = [
    { title: '家庭名称', dataIndex: 'name', key: 'name' },
    { title: '联系人', dataIndex: 'contact_person', key: 'contact_person', width: 100 },
    { title: '电话', dataIndex: 'phone', key: 'phone', width: 130 },
    { title: '地址', dataIndex: 'address', key: 'address', ellipsis: true },
    {
      title: '总额度',
      dataIndex: 'quota_pool',
      key: 'quota_pool',
      width: 120,
      render: (v: number) => <Tag color="green">{v} 天</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 260,
      render: (_: any, record: Family) => (
        <Space>
          <Button size="small" onClick={() => handleViewPets(record)}>宠物</Button>
          <Button size="small" type="primary" onClick={() => handleViewQuota(record)}>额度</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 className="page-title" style={{ margin: 0 }}>家庭与共享额度</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新建家庭
        </Button>
      </div>

      <Table rowKey="id" columns={columns} dataSource={families} pagination={{ pageSize: 10 }} />

      <Modal
        title={editing ? '编辑家庭' : '新建家庭'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmitFamily}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item label="家庭名称" name="name" rules={[{ required: true, message: '请输入' }]}>
            <Input placeholder="如：张三家" />
          </Form.Item>
          <Form.Item label="联系人" name="contact_person" rules={[{ required: true, message: '请输入' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="电话" name="phone" rules={[{ required: true, message: '请输入' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="地址" name="address">
            <Input />
          </Form.Item>
          <Form.Item label="初始共享额度(天)" name="quota_pool" initialValue={0}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`${selectedFamily?.name} - 宠物列表`}
        open={petsModalOpen}
        onCancel={() => setPetsModalOpen(false)}
        footer={[
          <Button key="add" type="primary" icon={<PlusOutlined />} onClick={handleAddPet}>
            添加宠物
          </Button>,
          <Button key="close" onClick={() => setPetsModalOpen(false)}>关闭</Button>,
        ]}
        width={700}
      >
        <List
          dataSource={familyPets}
          locale={{ emptyText: '暂无宠物，点击"添加宠物"' }}
          renderItem={(p) => (
            <List.Item
              actions={[
                <Button key="edit" size="small" icon={<EditOutlined />} onClick={() => handleEditPet(p)}>
                  编辑
                </Button>,
                <Popconfirm key="del" title="确认删除？" onConfirm={() => handleDeletePet(p.id)}>
                  <Button size="small" danger icon={<DeleteOutlined />}>
                    删除
                  </Button>
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                title={
                  <Space>
                    <strong>{p.name}</strong>
                    <Tag color="blue">{p.species}</Tag>
                    {p.breed && <span style={{ color: '#8c8c8c' }}>{p.breed}</span>}
                  </Space>
                }
                description={
                  <Space split={<Divider type="vertical" />}>
                    {p.age !== null && `${p.age} 岁`}
                    {p.weight !== null && `${p.weight} kg`}
                    {p.notes && <span>备注: {p.notes}</span>}
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Modal>

      <Modal
        title={editingPet ? '编辑宠物' : '添加宠物'}
        open={petModalOpen}
        onCancel={() => setPetModalOpen(false)}
        onOk={handleSubmitPet}
        okText="保存"
      >
        <Form form={petForm} layout="vertical">
          <Form.Item label="名字" name="name" rules={[{ required: true, message: '请输入' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="物种" name="species" rules={[{ required: true, message: '请选择' }]}>
            <Select>
              <Select.Option value="狗">狗</Select.Option>
              <Select.Option value="猫">猫</Select.Option>
              <Select.Option value="其他">其他</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item label="品种" name="breed">
            <Input />
          </Form.Item>
          <Form.Item label="年龄(岁)" name="age">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="体重(kg)" name="weight">
            <InputNumber min={0} step={0.1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="备注" name="notes">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`${selectedFamily?.name} - 共享额度详情`}
        open={quotaModalOpen}
        onCancel={() => setQuotaModalOpen(false)}
        footer={<Button onClick={() => setQuotaModalOpen(false)}>关闭</Button>}
        width={650}
      >
        {quotaInfo && (
          <Card size="small" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={12}>
                <Progress
                  type="dashboard"
                  percent={quotaInfo.quota_pool === 0 ? 0 : Math.round((quotaInfo.used_quota / quotaInfo.quota_pool) * 100)}
                  format={() => `${quotaInfo.available_quota} / ${quotaInfo.quota_pool} 天`}
                  strokeColor="#52c41a"
                />
              </Col>
              <Col span={12}>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="总额度">{quotaInfo.quota_pool} 天</Descriptions.Item>
                  <Descriptions.Item label="已使用（活跃预订）">{quotaInfo.used_quota} 天</Descriptions.Item>
                  <Descriptions.Item label="可用余额" style={{ color: '#52c41a' }}>
                    <strong>{quotaInfo.available_quota} 天</strong>
                  </Descriptions.Item>
                </Descriptions>
                <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 8 }}>
                  以下按钮调整总额度，可用余额 = 总额度 - 已使用
                </div>
                <Space style={{ marginTop: 4 }}>
                  <Button icon={<PlusCircleOutlined />} type="primary" onClick={() => handleAdjustQuota(5)}>
                    总额度+5
                  </Button>
                  <Button icon={<PlusCircleOutlined />} onClick={() => handleAdjustQuota(10)}>
                    总额度+10
                  </Button>
                  <Button icon={<MinusCircleOutlined />} danger onClick={() => handleAdjustQuota(-5)}>
                    总额度-5
                  </Button>
                </Space>
              </Col>
            </Row>
          </Card>
        )}
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>额度变动记录</div>
        <List
          size="small"
          dataSource={quotaHistory}
          locale={{ emptyText: '暂无记录' }}
          renderItem={(t) => (
            <List.Item>
              <Space style={{ width: '100%' }} split={<Divider type="vertical" />}>
                <Tag color={t.change_amount > 0 ? 'green' : 'red'}>
                  {t.change_amount > 0 ? '+' : ''}{t.change_amount} 天
                </Tag>
                <span>{t.reason}</span>
                <span style={{ color: '#8c8c8c' }}>可用: {t.balance_after}天</span>
                <span style={{ color: '#bfbfbf', marginLeft: 'auto' }}>{t.created_at}</span>
              </Space>
            </List.Item>
          )}
        />
      </Modal>
    </div>
  );
}

export default FamiliesPage;
