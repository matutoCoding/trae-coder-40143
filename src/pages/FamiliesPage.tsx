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
  Statistic,
  DatePicker,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusCircleOutlined,
  MinusCircleOutlined,
  ShoppingCartOutlined,
  FileTextOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Family, Pet, QuotaInfo, QuotaTransaction, QuotaPackage, MonthlyBill } from '../types';
import { BOOKING_STATUS_LABELS, BOOKING_STATUS_COLORS } from '../types';

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
  const [packages, setPackages] = useState<QuotaPackage[]>([]);

  const [billModalOpen, setBillModalOpen] = useState(false);
  const [billMonth, setBillMonth] = useState(dayjs());
  const [billData, setBillData] = useState<MonthlyBill | null>(null);
  const [billLoading, setBillLoading] = useState(false);

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
      const [info, history, pkgList] = await Promise.all([
        window.api.families.getQuota(f.id),
        window.api.families.getQuotaHistory(f.id),
        window.api.families.listPackages(),
      ]);
      setQuotaInfo(info);
      setQuotaHistory(history);
      setPackages(pkgList);
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

  const handlePurchasePackage = async (packageId: string) => {
    if (!selectedFamily) return;
    try {
      await window.api.families.purchasePackage(selectedFamily.id, packageId);
      message.success('购买成功');
      const [info, history] = await Promise.all([
        window.api.families.getQuota(selectedFamily.id),
        window.api.families.getQuotaHistory(selectedFamily.id),
      ]);
      setQuotaInfo(info);
      setQuotaHistory(history);
      loadFamilies();
    } catch (e: any) {
      message.error(e.message || '购买失败');
    }
  };

  const handleViewBill = (f: Family) => {
    setSelectedFamily(f);
    setBillMonth(dayjs());
    setBillData(null);
    setBillModalOpen(true);
  };

  const loadBillData = async (familyId: string, month: dayjs.Dayjs) => {
    setBillLoading(true);
    try {
      const data = await window.api.families.getMonthlyBill(familyId, month.format('YYYY-MM'));
      setBillData(data);
    } catch (e: any) {
      message.error(e.message || '获取账单失败');
    } finally {
      setBillLoading(false);
    }
  };

  useEffect(() => {
    if (billModalOpen && selectedFamily) {
      loadBillData(selectedFamily.id, billMonth);
    }
  }, [billModalOpen, billMonth]);

  const handleExportBill = () => {
    if (!billData || !selectedFamily) return;
    const monthStr = billMonth.format('YYYY-MM');
    const lines: string[] = [];
    lines.push(`家庭,${selectedFamily.name}`);
    lines.push(`账单周期,${monthStr}`);
    lines.push('');
    lines.push('额度概要');
    lines.push(`总额度,${billData.quota_pool} 天`);
    lines.push(`已使用,${billData.used_quota} 天`);
    lines.push(`可用余额,${billData.available_quota} 天`);
    lines.push('');
    lines.push('购买统计');
    lines.push(`购买天数,${billData.total_purchased_days} 天`);
    lines.push(`购买金额,¥${billData.total_purchased_amount}`);
    lines.push(`活跃预订,${billData.active_bookings}`);
    lines.push(`取消预订,${billData.cancelled_bookings}`);
    lines.push('');
    lines.push('交易记录');
    lines.push('日期,变动,原因,余额');
    billData.transactions.forEach((t) => {
      lines.push(`${dayjs(t.created_at).format('YYYY-MM-DD HH:mm')},${t.change_amount > 0 ? '+' : ''}${t.change_amount} 天,${t.reason || ''},${t.balance_after} 天`);
    });
    lines.push('');
    lines.push('预订记录');
    lines.push('宠物,房间,日期,状态,金额');
    billData.bookings.forEach((b: any) => {
      lines.push(`${b.pet_name || ''},${b.room_name || ''},${b.start_date} ~ ${b.end_date},${BOOKING_STATUS_LABELS[b.status as keyof typeof BOOKING_STATUS_LABELS] || b.status},¥${b.total_amount}`);
    });
    const csvContent = '\uFEFF' + lines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedFamily.name}_${monthStr}_账单.csv`;
    link.click();
    URL.revokeObjectURL(url);
    message.success('导出成功');
  };

  const transactionColumns = [
    {
      title: '日期',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '变动',
      dataIndex: 'change_amount',
      key: 'change_amount',
      width: 100,
      render: (v: number) => (
        <span style={{ color: v > 0 ? '#52c41a' : '#ff4d4f', fontWeight: 600 }}>
          {v > 0 ? '+' : ''}{v} 天
        </span>
      ),
    },
    { title: '原因', dataIndex: 'reason', key: 'reason', ellipsis: true },
    {
      title: '余额',
      dataIndex: 'balance_after',
      key: 'balance_after',
      width: 100,
      render: (v: number) => `${v} 天`,
    },
  ];

  const bookingColumns = [
    { title: '宠物', dataIndex: 'pet_name', key: 'pet_name', width: 100 },
    { title: '房间', dataIndex: 'room_name', key: 'room_name', width: 100 },
    {
      title: '日期',
      key: 'dates',
      width: 180,
      render: (_: any, r: any) => `${r.start_date} ~ ${r.end_date}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (v: string) => (
        <Tag color={BOOKING_STATUS_COLORS[v as keyof typeof BOOKING_STATUS_COLORS] || 'default'}>
          {BOOKING_STATUS_LABELS[v as keyof typeof BOOKING_STATUS_LABELS] || v}
        </Tag>
      ),
    },
    {
      title: '金额',
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 90,
      render: (v: number) => `¥${v}`,
    },
  ];

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
      width: 320,
      render: (_: any, record: Family) => (
        <Space>
          <Button size="small" onClick={() => handleViewPets(record)}>宠物</Button>
          <Button size="small" type="primary" onClick={() => handleViewQuota(record)}>额度</Button>
          <Button size="small" icon={<FileTextOutlined />} onClick={() => handleViewBill(record)}>
            月度账单
          </Button>
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
        width={700}
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

        <Divider orientation="left" style={{ fontSize: 14 }}>
          <ShoppingCartOutlined /> 套餐购买
        </Divider>
        {packages.length === 0 ? (
          <div style={{ color: '#8c8c8c', textAlign: 'center', padding: '12px 0' }}>暂无可购套餐</div>
        ) : (
          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            {packages.map((pkg) => (
              <Col span={12} key={pkg.id}>
                <Card size="small" hoverable>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{pkg.name}</div>
                  <div style={{ color: '#8c8c8c', fontSize: 13, marginBottom: 8 }}>
                    {pkg.description || `${pkg.days} 天额度`}
                  </div>
                  <Row justify="space-between" align="middle">
                    <Col>
                      <Space split={<Divider type="vertical" />}>
                        <Tag color="blue">{pkg.days} 天</Tag>
                        <span style={{ color: '#ff4d4f', fontWeight: 600, fontSize: 16 }}>¥{pkg.price}</span>
                      </Space>
                    </Col>
                    <Col>
                      <Button
                        type="primary"
                        size="small"
                        icon={<ShoppingCartOutlined />}
                        onClick={() => handlePurchasePackage(pkg.id)}
                      >
                        购买
                      </Button>
                    </Col>
                  </Row>
                </Card>
              </Col>
            ))}
          </Row>
        )}

        <Divider orientation="left" style={{ fontSize: 14 }}>额度变动记录</Divider>
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

      <Modal
        title={`${selectedFamily?.name} - 月度账单`}
        open={billModalOpen}
        onCancel={() => setBillModalOpen(false)}
        footer={[
          <Button key="export" icon={<DownloadOutlined />} onClick={handleExportBill} disabled={!billData}>
            导出账单
          </Button>,
          <Button key="close" onClick={() => setBillModalOpen(false)}>关闭</Button>,
        ]}
        width={800}
      >
        <div style={{ marginBottom: 16 }}>
          <DatePicker
            picker="month"
            value={billMonth}
            onChange={(v) => v && setBillMonth(v)}
            allowClear={false}
          />
        </div>

        {billLoading && <div style={{ textAlign: 'center', padding: 24 }}>加载中...</div>}

        {billData && !billLoading && (
          <>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={8}>
                <Card size="small">
                  <Statistic title="总额度" value={billData.quota_pool} suffix="天" valueStyle={{ color: '#1890ff' }} />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small">
                  <Statistic title="已使用" value={billData.used_quota} suffix="天" valueStyle={{ color: '#faad14' }} />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small">
                  <Statistic title="可用余额" value={billData.available_quota} suffix="天" valueStyle={{ color: '#52c41a' }} />
                </Card>
              </Col>
            </Row>

            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="购买天数">{billData.total_purchased_days} 天</Descriptions.Item>
              <Descriptions.Item label="购买金额">¥{billData.total_purchased_amount}</Descriptions.Item>
              <Descriptions.Item label="活跃预订">{billData.active_bookings}</Descriptions.Item>
              <Descriptions.Item label="取消预订">{billData.cancelled_bookings}</Descriptions.Item>
            </Descriptions>

            <Divider orientation="left" style={{ fontSize: 14 }}>交易记录</Divider>
            <Table
              rowKey="id"
              size="small"
              columns={transactionColumns}
              dataSource={billData.transactions}
              pagination={false}
              locale={{ emptyText: '暂无交易记录' }}
              style={{ marginBottom: 16 }}
            />

            <Divider orientation="left" style={{ fontSize: 14 }}>预订记录</Divider>
            <Table
              rowKey="id"
              size="small"
              columns={bookingColumns}
              dataSource={billData.bookings}
              pagination={false}
              locale={{ emptyText: '暂无预订记录' }}
            />
          </>
        )}
      </Modal>
    </div>
  );
}

export default FamiliesPage;
