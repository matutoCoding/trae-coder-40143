import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Tabs,
  Table,
  Tag,
  Button,
  Modal,
  Form,
  Input,
  DatePicker,
  message,
  Space,
  Descriptions,
  Tooltip,
} from 'antd';
import {
  MedicineBoxOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  UserOutlined,
  EditOutlined,
  StopOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { ANOMALY_TYPE_LABELS } from '../types';

const { TextArea } = Input;

interface HealthFollowup {
  id: string;
  pet_name: string;
  family_name: string;
  anomaly_type: string;
  status: 'open' | 'handling' | 'pending_recheck' | 'closed';
  assigned_to: string | null;
  initial_note: string;
  handling_result: string | null;
  close_note: string | null;
  recheck_time: string | null;
  created_at: string;
  updated_at: string;
}

interface Stats {
  open: { cnt: number };
  today: { cnt: number };
  closed: { cnt: number };
}

const STATUS_LABELS: Record<string, string> = {
  open: '待指派',
  handling: '处理中',
  pending_recheck: '待复查',
  closed: '已关闭',
};

const STATUS_COLORS: Record<string, string> = {
  open: 'orange',
  handling: 'blue',
  pending_recheck: 'purple',
  closed: 'green',
};

function HealthPage() {
  const [stats, setStats] = useState<Stats>({
    open: { cnt: 0 },
    today: { cnt: 0 },
    closed: { cnt: 0 },
  });
  const [activeTab, setActiveTab] = useState<string>('all');
  const [followups, setFollowups] = useState<HealthFollowup[]>([]);
  const [loading, setLoading] = useState(false);

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [handlingModalOpen, setHandlingModalOpen] = useState(false);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedFollowup, setSelectedFollowup] = useState<HealthFollowup | null>(null);

  const [assignForm] = Form.useForm();
  const [handlingForm] = Form.useForm();
  const [closeForm] = Form.useForm();

  const loadStats = async () => {
    try {
      const data = await window.api.health.stats();
      setStats(data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadFollowups = async (tabKey: string) => {
    setLoading(true);
    try {
      let status: string | undefined;
      if (tabKey === 'open') status = 'open';
      else if (tabKey === 'handling') status = 'handling,pending_recheck';
      else if (tabKey === 'closed') status = 'closed';
      const data = await window.api.health.list(status);
      setFollowups(data);
    } catch (e: any) {
      message.error(e.message || '加载跟进单失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    loadFollowups(activeTab);
  }, [activeTab]);

  const refreshAll = () => {
    loadStats();
    loadFollowups(activeTab);
  };

  const handleAssign = (record: HealthFollowup) => {
    setSelectedFollowup(record);
    assignForm.resetFields();
    setAssignModalOpen(true);
  };

  const confirmAssign = async () => {
    if (!selectedFollowup) return;
    try {
      const values = await assignForm.validateFields();
      await window.api.health.assign(selectedFollowup.id, values.assigned_to);
      message.success('指派成功');
      setAssignModalOpen(false);
      refreshAll();
    } catch (e: any) {
      message.error(e.message || '指派失败');
    }
  };

  const handleRecordHandling = (record: HealthFollowup) => {
    setSelectedFollowup(record);
    handlingForm.resetFields();
    setHandlingModalOpen(true);
  };

  const confirmHandling = async () => {
    if (!selectedFollowup) return;
    try {
      const values = await handlingForm.validateFields();
      const recheckTime = values.recheck_time ? values.recheck_time.format('YYYY-MM-DD HH:mm:ss') : undefined;
      await window.api.health.recordHandling(selectedFollowup.id, values.handling_result, recheckTime);
      message.success('处理结果已记录');
      setHandlingModalOpen(false);
      refreshAll();
    } catch (e: any) {
      message.error(e.message || '记录失败');
    }
  };

  const handleClose = (record: HealthFollowup) => {
    setSelectedFollowup(record);
    closeForm.resetFields();
    setCloseModalOpen(true);
  };

  const confirmClose = async () => {
    if (!selectedFollowup) return;
    try {
      const values = await closeForm.validateFields();
      await window.api.health.close(selectedFollowup.id, values.close_note);
      message.success('跟进单已关闭');
      setCloseModalOpen(false);
      refreshAll();
    } catch (e: any) {
      message.error(e.message || '关闭失败');
    }
  };

  const handleViewDetail = (record: HealthFollowup) => {
    setSelectedFollowup(record);
    setDetailModalOpen(true);
  };

  const tabItems = [
    { key: 'all', label: '全部' },
    { key: 'open', label: '待指派' },
    { key: 'handling', label: '处理中' },
    { key: 'closed', label: '已关闭' },
  ];

  const columns = [
    {
      title: '宠物信息',
      dataIndex: 'pet_name',
      key: 'pet_name',
      render: (_: string, record: HealthFollowup) => (
        <div>
          <div style={{ fontWeight: 600 }}>{record.pet_name}</div>
          <Tag style={{ marginTop: 4 }}>{record.family_name}</Tag>
        </div>
      ),
    },
    {
      title: '异常类型',
      dataIndex: 'anomaly_type',
      key: 'anomaly_type',
      render: (type: string) => (
        <Tag color="red">{ANOMALY_TYPE_LABELS[type] || type}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={STATUS_COLORS[status]}>
          {STATUS_LABELS[status] || status}
        </Tag>
      ),
    },
    {
      title: '处理人',
      dataIndex: 'assigned_to',
      key: 'assigned_to',
      render: (val: string | null) => val || (
        <span style={{ color: '#8c8c8c' }}>待指派</span>
      ),
    },
    {
      title: '初始记录',
      dataIndex: 'initial_note',
      key: 'initial_note',
      ellipsis: true,
      render: (text: string) => (
        <Tooltip title={text}>
          <span>{text}</span>
        </Tooltip>
      ),
    },
    {
      title: '复查时间',
      dataIndex: 'recheck_time',
      key: 'recheck_time',
      render: (time: string | null) => time ? dayjs(time).format('YYYY-MM-DD HH:mm') : '',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: HealthFollowup) => {
        const actions: React.ReactNode[] = [];

        if (record.status === 'open') {
          actions.push(
            <Button
              key="assign"
              type="link"
              size="small"
              icon={<UserOutlined />}
              onClick={() => handleAssign(record)}
            >
              指派
            </Button>
          );
        }

        if (record.status === 'handling' || record.status === 'pending_recheck') {
          actions.push(
            <Button
              key="record"
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleRecordHandling(record)}
            >
              记录结果
            </Button>
          );
          actions.push(
            <Button
              key="close"
              type="link"
              size="small"
              danger
              icon={<StopOutlined />}
              onClick={() => handleClose(record)}
            >
              关闭跟进
            </Button>
          );
        }

        if (record.status === 'closed') {
          actions.push(
            <Button
              key="detail"
              type="link"
              size="small"
              onClick={() => handleViewDetail(record)}
            >
              查看详情
            </Button>
          );
        }

        return <Space size={4}>{actions}</Space>;
      },
    },
  ];

  return (
    <div>
      <h2 className="page-title" style={{ margin: '0 0 16px 0' }}>健康跟进管理</h2>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="待处理跟进单"
              value={stats.open.cnt}
              valueStyle={{ color: '#fa8c16' }}
              prefix={<MedicineBoxOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="今日新增"
              value={stats.today.cnt}
              valueStyle={{ color: '#1890ff' }}
              prefix={<PlayCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="已关闭"
              value={stats.closed.cnt}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
        />
        <Table
          rowKey="id"
          columns={columns}
          dataSource={followups}
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
        />
      </Card>

      <Modal
        title="指派处理人"
        open={assignModalOpen}
        onCancel={() => setAssignModalOpen(false)}
        onOk={confirmAssign}
        okText="确认指派"
        cancelText="取消"
      >
        <Descriptions column={1} size="small" style={{ marginBottom: 16 }}>
          <Descriptions.Item label="宠物">{selectedFollowup?.pet_name}</Descriptions.Item>
          <Descriptions.Item label="家庭">{selectedFollowup?.family_name}</Descriptions.Item>
          <Descriptions.Item label="异常类型">
            <Tag color="red">
              {selectedFollowup && (ANOMALY_TYPE_LABELS[selectedFollowup.anomaly_type] || selectedFollowup.anomaly_type)}
            </Tag>
          </Descriptions.Item>
        </Descriptions>
        <Form form={assignForm} layout="vertical">
          <Form.Item
            label="处理人"
            name="assigned_to"
            rules={[{ required: true, message: '请输入处理人姓名' }]}
          >
            <Input placeholder="请输入处理人姓名" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="记录处理结果"
        open={handlingModalOpen}
        onCancel={() => setHandlingModalOpen(false)}
        onOk={confirmHandling}
        okText="保存记录"
        cancelText="取消"
        width={520}
      >
        <Descriptions column={1} size="small" style={{ marginBottom: 16 }}>
          <Descriptions.Item label="宠物">{selectedFollowup?.pet_name}</Descriptions.Item>
          <Descriptions.Item label="处理人">{selectedFollowup?.assigned_to || '待指派'}</Descriptions.Item>
          <Descriptions.Item label="当前状态">
            {selectedFollowup && <Tag color={STATUS_COLORS[selectedFollowup.status]}>{STATUS_LABELS[selectedFollowup.status]}</Tag>}
          </Descriptions.Item>
        </Descriptions>
        <Form form={handlingForm} layout="vertical">
          <Form.Item
            label="处理结果"
            name="handling_result"
            rules={[{ required: true, message: '请输入处理结果' }]}
          >
            <TextArea rows={4} placeholder="请描述处理过程和结果" />
          </Form.Item>
          <Form.Item label="复查时间（可选）" name="recheck_time">
            <DatePicker
              showTime
              style={{ width: '100%' }}
              format="YYYY-MM-DD HH:mm"
              placeholder="选择复查时间"
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="关闭跟进单"
        open={closeModalOpen}
        onCancel={() => setCloseModalOpen(false)}
        onOk={confirmClose}
        okText="确认关闭"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <p style={{ color: '#faad14', marginBottom: 16 }}>
          <CloseCircleOutlined /> 关闭后将无法继续跟进，请确认处理已完成
        </p>
        <Form form={closeForm} layout="vertical">
          <Form.Item
            label="关闭说明"
            name="close_note"
            rules={[{ required: true, message: '请输入关闭说明' }]}
          >
            <TextArea rows={3} placeholder="请说明关闭原因，如宠物已恢复正常等" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="跟进单详情"
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalOpen(false)}>
            关闭
          </Button>,
        ]}
        width={560}
      >
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="宠物">
            <strong>{selectedFollowup?.pet_name}</strong>
          </Descriptions.Item>
          <Descriptions.Item label="所属家庭">{selectedFollowup?.family_name}</Descriptions.Item>
          <Descriptions.Item label="异常类型">
            {selectedFollowup && <Tag color="red">{ANOMALY_TYPE_LABELS[selectedFollowup.anomaly_type] || selectedFollowup.anomaly_type}</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            {selectedFollowup && <Tag color={STATUS_COLORS[selectedFollowup.status]}>{STATUS_LABELS[selectedFollowup.status]}</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label="处理人">{selectedFollowup?.assigned_to || '待指派'}</Descriptions.Item>
          <Descriptions.Item label="初始记录">
            <div style={{ whiteSpace: 'pre-wrap' }}>{selectedFollowup?.initial_note}</div>
          </Descriptions.Item>
          <Descriptions.Item label="处理结果">
            <div style={{ whiteSpace: 'pre-wrap' }}>{selectedFollowup?.handling_result || '-'}</div>
          </Descriptions.Item>
          <Descriptions.Item label="关闭说明">
            <div style={{ whiteSpace: 'pre-wrap' }}>{selectedFollowup?.close_note || '-'}</div>
          </Descriptions.Item>
          <Descriptions.Item label="复查时间">
            {selectedFollowup?.recheck_time ? dayjs(selectedFollowup.recheck_time).format('YYYY-MM-DD HH:mm') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {selectedFollowup?.created_at ? dayjs(selectedFollowup.created_at).format('YYYY-MM-DD HH:mm') : '-'}
          </Descriptions.Item>
        </Descriptions>
      </Modal>
    </div>
  );
}

export default HealthPage;
