import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Button,
  Modal,
  Input,
  Form,
  DatePicker,
  message,
  Space,
  Tooltip,
} from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { ROOM_TYPE_LABELS, type RoomCleaning } from '../types';

const { TextArea } = Input;

const CLEANING_STATUS_LABELS: Record<string, string> = {
  pending: '待清洁',
  in_progress: '清洁中',
  done: '已完成',
  overdue: '超时未处理',
};

const CLEANING_STATUS_COLORS: Record<string, string> = {
  pending: 'orange',
  in_progress: 'blue',
  done: 'green',
  overdue: 'red',
};

interface StatsResponse {
  cnt: number;
}

function CleaningsPage() {
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [stats, setStats] = useState({
    pending: 0,
    in_progress: 0,
    done: 0,
    overdue: 0,
  });
  const [data, setData] = useState<RoomCleaning[]>([]);
  const [loading, setLoading] = useState(false);
  const [startModalOpen, setStartModalOpen] = useState(false);
  const [finishModalOpen, setFinishModalOpen] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<RoomCleaning | null>(null);
  const [startForm] = Form.useForm();
  const [finishForm] = Form.useForm();

  const loadStats = async () => {
    try {
      const [pendingRes, inProgressRes, doneRes, overdueRes] = await Promise.all([
        window.api.cleanings.stats('pending', date) as Promise<StatsResponse>,
        window.api.cleanings.stats('in_progress', date) as Promise<StatsResponse>,
        window.api.cleanings.stats('done', date) as Promise<StatsResponse>,
        window.api.cleanings.stats('overdue', date) as Promise<StatsResponse>,
      ]);
      setStats({
        pending: pendingRes.cnt,
        in_progress: inProgressRes.cnt,
        done: doneRes.cnt,
        overdue: overdueRes.cnt,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const loadList = async () => {
    setLoading(true);
    try {
      const list = await window.api.cleanings.list(date);
      setData(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadAll = () => {
    loadStats();
    loadList();
  };

  useEffect(() => {
    loadAll();
  }, [date]);

  const handleStartCleaning = (record: RoomCleaning) => {
    setCurrentRecord(record);
    startForm.resetFields();
    setStartModalOpen(true);
  };

  const handleSubmitStart = async () => {
    if (!currentRecord) return;
    try {
      const values = await startForm.validateFields();
      await window.api.cleanings.start(currentRecord.id, values.assigned_to);
      message.success('已开始清洁');
      setStartModalOpen(false);
      loadAll();
    } catch (e: any) {
      message.error(e.message || '操作失败');
    }
  };

  const handleFinishCleaning = (record: RoomCleaning) => {
    setCurrentRecord(record);
    finishForm.resetFields();
    setFinishModalOpen(true);
  };

  const handleSubmitFinish = async () => {
    if (!currentRecord) return;
    try {
      const values = await finishForm.validateFields();
      await window.api.cleanings.finish(
        currentRecord.id,
        values.inspector,
        values.inspection_note
      );
      message.success('清洁已完成');
      setFinishModalOpen(false);
      loadAll();
    } catch (e: any) {
      message.error(e.message || '操作失败');
    }
  };

  const columns = [
    {
      title: '房间',
      dataIndex: 'room_name',
      key: 'room_name',
      width: 160,
      render: (_: string, record: RoomCleaning) => (
        <Space>
          <span style={{ fontWeight: 500 }}>{record.room_name}</span>
          {record.room_type && (
            <Tag color="blue">{ROOM_TYPE_LABELS[record.room_type] || record.room_type}</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => {
        const label = CLEANING_STATUS_LABELS[status] || status;
        const color = CLEANING_STATUS_COLORS[status] || 'default';
        return (
          <Tooltip title={label}>
            <Tag color={color} style={{ margin: 0 }}>
              {label}
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: '清洁人员',
      dataIndex: 'assigned_to',
      key: 'assigned_to',
      width: 120,
      render: (v: string | null) => v || '-',
    },
    {
      title: '退房时间',
      dataIndex: 'check_out_time',
      key: 'check_out_time',
      width: 160,
      render: (v: string | null) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_: any, record: RoomCleaning) => {
        if (record.status === 'pending' || record.status === 'overdue') {
          return (
            <Space direction="vertical" size={4}>
              {record.status === 'overdue' && (
                <Tag color="red" style={{ fontSize: 11 }}>超时未处理</Tag>
              )}
              <Button
                type="primary"
                size="small"
                danger={record.status === 'overdue'}
                icon={<PlayCircleOutlined />}
                onClick={() => handleStartCleaning(record)}
              >
                开始清洁
              </Button>
            </Space>
          );
        }
        if (record.status === 'in_progress') {
          return (
            <Button
              type="primary"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleFinishCleaning(record)}
            >
              完成清洁
            </Button>
          );
        }
        return <Tag color="green">✓ 已完成</Tag>;
      },
    },
  ];

  const statCards = [
    {
      title: '待清洁',
      value: stats.pending,
      color: '#fa8c16',
      icon: <ClockCircleOutlined style={{ fontSize: 28, color: '#fa8c16' }} />,
      bgColor: '#fff7e6',
    },
    {
      title: '清洁中',
      value: stats.in_progress,
      color: '#1890ff',
      icon: <SyncOutlined spin style={{ fontSize: 28, color: '#1890ff' }} />,
      bgColor: '#e6f7ff',
    },
    {
      title: '已完成',
      value: stats.done,
      color: '#52c41a',
      icon: <CheckCircleOutlined style={{ fontSize: 28, color: '#52c41a' }} />,
      bgColor: '#f6ffed',
    },
    {
      title: '超时未处理',
      value: stats.overdue,
      color: '#ff4d4f',
      icon: <ClockCircleOutlined style={{ fontSize: 28, color: '#ff4d4f' }} />,
      bgColor: '#fff1f0',
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 className="page-title" style={{ margin: 0 }}>房间清洁管理</h2>
        <Space>
          <DatePicker
            value={dayjs(date)}
            onChange={(d) => d && setDate(d.format('YYYY-MM-DD'))}
            allowClear={false}
          />
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {statCards.map((card) => (
          <Col xs={12} sm={12} lg={6} key={card.title}>
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 12,
                    background: card.bgColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {card.icon}
                </div>
                <div>
                  <Statistic
                    title={card.title}
                    value={card.value}
                    valueStyle={{ color: card.color, fontSize: 28, fontWeight: 600 }}
                  />
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Card>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: '暂无清洁任务' }}
        />
      </Card>

      <Modal
        title={`开始清洁 - ${currentRecord?.room_name || ''}`}
        open={startModalOpen}
        onCancel={() => setStartModalOpen(false)}
        onOk={handleSubmitStart}
        okText="确认开始"
        cancelText="取消"
        width={480}
      >
        <Form form={startForm} layout="vertical">
          <Form.Item
            label="清洁人员"
            name="assigned_to"
            rules={[{ required: true, message: '请输入清洁人员姓名' }]}
          >
            <Input placeholder="请输入清洁人员姓名" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`完成清洁 - ${currentRecord?.room_name || ''}`}
        open={finishModalOpen}
        onCancel={() => setFinishModalOpen(false)}
        onOk={handleSubmitFinish}
        okText="确认完成"
        cancelText="取消"
        width={520}
      >
        <Form form={finishForm} layout="vertical">
          <Form.Item
            label="检查员"
            name="inspector"
            rules={[{ required: true, message: '请输入检查员姓名' }]}
          >
            <Input placeholder="请输入检查员姓名" />
          </Form.Item>
          <Form.Item label="检查备注" name="inspection_note">
            <TextArea rows={4} placeholder="清洁情况备注，有无问题等" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default CleaningsPage;
