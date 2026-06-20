import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Table, Tag, Button, Space, List, Alert, Statistic } from 'antd';
import { PlusOutlined, WarningOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { BOOKING_STATUS_LABELS, BOOKING_STATUS_COLORS, ANOMALY_TYPE_LABELS, type Booking } from '../types';

const TIME_SLOT_LABELS: Record<string, string> = {
  morning: '早餐',
  noon: '午餐',
  evening: '晚餐',
};

interface AnomalyRecord {
  id: string;
  pet_name: string;
  family_name: string;
  room_name: string;
  anomaly_type: string;
  time_slot: string;
  note: string | null;
  date: string;
  created_at: string;
}

interface Props {
  onNavigate: (key: string) => void;
}

function DashboardPage({ onNavigate }: Props) {
  const [stats, setStats] = useState({
    totalRooms: 0,
    occupiedRooms: 0,
    activeBookings: 0,
    waitlistCount: 0,
    checkedInToday: 0,
  });
  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyRecord[]>([]);

  const loadData = async () => {
    try {
      const today = dayjs().format('YYYY-MM-DD');
      const rooms = await window.api.rooms.list();
      const schedule = await window.api.rooms.getSchedule(today, today);
      const occupied = schedule.filter((r: any) => r.bookings.length > 0).length;

      const bookings = await window.api.bookings.list();
      const active = bookings.filter(
        (b: Booking) => b.status === 'pending' || b.status === 'checked_in'
      ).length;
      const checkedInToday = bookings.filter(
        (b: Booking) => b.status === 'checked_in'
      ).length;

      const waitlist = await window.api.waitlist.list();

      setStats({
        totalRooms: rooms.filter((r: any) => r.status === 'active').length,
        occupiedRooms: occupied,
        activeBookings: active,
        waitlistCount: waitlist.length,
        checkedInToday,
      });

      setRecentBookings(bookings.slice(0, 8));

      const anomalyList = await window.api.feedings.anomalies(today, today);
      setAnomalies(anomalyList);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const anomalyCount = anomalies.length;

  const statCards = [
    {
      label: '宠物间总数',
      value: stats.totalRooms,
      icon: '🏠',
      color: '#1890ff',
      onClick: () => onNavigate('schedule'),
    },
    {
      label: '当前使用中',
      value: stats.occupiedRooms,
      icon: '🐶',
      color: '#52c41a',
      onClick: () => onNavigate('schedule'),
    },
    {
      label: '活跃预订',
      value: stats.activeBookings,
      icon: '📋',
      color: '#faad14',
      onClick: () => onNavigate('schedule'),
    },
    {
      label: '候补充位',
      value: stats.waitlistCount,
      icon: '⏳',
      color: '#722ed1',
      onClick: () => onNavigate('waitlist'),
    },
    {
      label: '今日异常',
      value: anomalyCount,
      icon: '⚠️',
      color: anomalyCount > 0 ? '#ff4d4f' : '#52c41a',
      onClick: () => onNavigate('feeding'),
    },
  ];

  const columns = [
    {
      title: '宠物',
      dataIndex: 'pet_name',
      key: 'pet_name',
    },
    {
      title: '家庭',
      dataIndex: 'family_name',
      key: 'family_name',
    },
    {
      title: '房间',
      dataIndex: 'room_name',
      key: 'room_name',
    },
    {
      title: '入住日期',
      dataIndex: 'start_date',
      key: 'start_date',
    },
    {
      title: '离店日期',
      dataIndex: 'end_date',
      key: 'end_date',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={BOOKING_STATUS_COLORS[status]}>{BOOKING_STATUS_LABELS[status]}</Tag>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 className="page-title" style={{ margin: 0 }}>控制台</h2>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => onNavigate('schedule')}>
            新建预订
          </Button>
          <Button onClick={() => onNavigate('feeding')}>今日喂养</Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {statCards.map((card) => (
          <Col xs={12} sm={6} lg={4} key={card.label}>
            <Card className="stat-card" hoverable onClick={card.onClick} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 36 }}>{card.icon}</span>
                <div>
                  <div className="stat-value" style={{ color: card.color }}>
                    {card.value}
                  </div>
                  <div className="stat-label">{card.label}</div>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Card
        title={
          <span>
            <WarningOutlined style={{ color: '#fa541c', marginRight: 8 }} />
            喂养异常提醒
          </span>
        }
        style={{ marginBottom: 24 }}
        extra={anomalyCount > 0 && <Tag color="red">{anomalyCount} 条异常</Tag>}
      >
        {anomalyCount === 0 ? (
          <Alert type="success" showIcon message="今日无异常" description="今日所有喂养记录正常，无异常上报。" />
        ) : (
          <List
            dataSource={anomalies}
            renderItem={(item) => (
              <List.Item>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                  <WarningOutlined style={{ color: '#fa541c', fontSize: 18 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, marginBottom: 4 }}>
                      {item.pet_name}
                      <Tag color="orange" style={{ marginLeft: 8 }}>{item.family_name}</Tag>
                      <Tag color="blue">{item.room_name}</Tag>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Tag color="red">{ANOMALY_TYPE_LABELS[item.anomaly_type] || item.anomaly_type}</Tag>
                      <Tag color="volcano">{TIME_SLOT_LABELS[item.time_slot] || item.time_slot}</Tag>
                      {item.note && <span style={{ color: '#8c8c8c', fontSize: 12 }}>{item.note}</span>}
                    </div>
                  </div>
                  <span style={{ color: '#8c8c8c', fontSize: 12 }}>
                    {item.created_at?.slice(11, 16)}
                  </span>
                </div>
              </List.Item>
            )}
          />
        )}
      </Card>

      <Card title="最近预订">
        <Table
          rowKey="id"
          dataSource={recentBookings}
          columns={columns}
          pagination={false}
          locale={{ emptyText: '暂无预订记录' }}
        />
      </Card>
    </div>
  );
}

export default DashboardPage;
