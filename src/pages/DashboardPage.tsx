import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Table, Tag, Button, Space } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { BOOKING_STATUS_LABELS, BOOKING_STATUS_COLORS, type Booking } from '../types';

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
        totalRooms: rooms.filter((r) => r.status === 'active').length,
        occupiedRooms: occupied,
        activeBookings: active,
        waitlistCount: waitlist.length,
        checkedInToday,
      });

      setRecentBookings(bookings.slice(0, 8));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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
          <Col xs={12} sm={6} key={card.label}>
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
