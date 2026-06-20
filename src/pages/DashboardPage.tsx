import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Table, Tag, Button, Space, List, Alert, Statistic } from 'antd';
import {
  PlusOutlined,
  WarningOutlined,
  MedicineBoxOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  HomeOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { BOOKING_STATUS_LABELS, BOOKING_STATUS_COLORS, ANOMALY_TYPE_LABELS, type Booking } from '../types';

const TIME_SLOT_LABELS: Record<string, string> = {
  morning: '早餐',
  noon: '午餐',
  evening: '晚餐',
};

const CLEANING_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: '待清洁', color: 'orange' },
  in_progress: { label: '清洁中', color: 'blue' },
  done: { label: '已清洁', color: 'green' },
  overdue: { label: '超时', color: 'red' },
};

const HEALTH_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  open: { label: '待指派', color: 'orange' },
  handling: { label: '处理中', color: 'blue' },
  pending_recheck: { label: '待复查', color: 'purple' },
  closed: { label: '已关闭', color: 'green' },
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

interface CleaningStat {
  status: string;
  cnt: number;
}

interface FollowupStat {
  status: string;
  cnt: number;
  items?: any[];
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
  const [cleaningStats, setCleaningStats] = useState<CleaningStat[]>([
    { status: 'pending', cnt: 0 },
    { status: 'in_progress', cnt: 0 },
    { status: 'done', cnt: 0 },
    { status: 'overdue', cnt: 0 },
  ]);
  const [openFollowups, setOpenFollowups] = useState<any[]>([]);
  const [followupStats, setFollowupStats] = useState({ open: 0, today: 0, closed: 0 });

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

      const [pendingStat, inProgressStat, doneStat, overdueStat] = await Promise.all([
        window.api.cleanings.stats('pending', today),
        window.api.cleanings.stats('in_progress', today),
        window.api.cleanings.stats('done', today),
        window.api.cleanings.stats('overdue', today),
      ]);
      setCleaningStats([
        { status: 'pending', cnt: pendingStat?.cnt || 0 },
        { status: 'in_progress', cnt: inProgressStat?.cnt || 0 },
        { status: 'done', cnt: doneStat?.cnt || 0 },
        { status: 'overdue', cnt: overdueStat?.cnt || 0 },
      ]);

      try {
        const healthStats = await window.api.health.stats();
        setFollowupStats({
          open: healthStats?.open?.cnt || 0,
          today: healthStats?.today?.cnt || 0,
          closed: healthStats?.closed?.cnt || 0,
        });

        const openList = await window.api.health.list('open');
        const handlingList = await window.api.health.list('handling');
        const recheckList = await window.api.health.list('pending_recheck');
        setOpenFollowups([...openList, ...handlingList, ...recheckList].slice(0, 8));
      } catch (e) {
        console.error('health stats error', e);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, []);

  const anomalyCount = anomalies.length;
  const totalCleaningToday = cleaningStats.reduce((s, c) => s + c.cnt, 0);

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

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card
            title={
              <span>
                <HomeOutlined style={{ color: '#1890ff', marginRight: 8 }} />
                今日清洁任务
              </span>
            }
            extra={
              <Button type="link" size="small" onClick={() => onNavigate('cleanings')}>
                去管理 →
              </Button>
            }
          >
            <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
              {cleaningStats.map((cs) => {
                const meta = CLEANING_STATUS_LABELS[cs.status];
                const iconMap: Record<string, any> = {
                  pending: <WarningOutlined style={{ color: '#fa8c16' }} />,
                  in_progress: <PlayCircleOutlined style={{ color: '#1890ff' }} spin={cs.cnt > 0} />,
                  done: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
                  overdue: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
                };
                return (
                  <Col xs={12} sm={6} key={cs.status}>
                    <div
                      style={{
                        padding: 8,
                        borderRadius: 4,
                        background: cs.cnt > 0 ? 'rgba(0,0,0,0.02)' : 'transparent',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: 20 }}>{iconMap[cs.status]}</div>
                      <div style={{ fontSize: 18, fontWeight: 600 }}>{cs.cnt}</div>
                      <Tag color={meta.color} style={{ margin: 0, marginTop: 4 }}>
                        {meta.label}
                      </Tag>
                    </div>
                  </Col>
                );
              })}
            </Row>
            {totalCleaningToday === 0 ? (
              <Alert type="info" showIcon message="今日暂无清洁任务" />
            ) : (
              <div style={{ fontSize: 12, color: '#8c8c8c', textAlign: 'center' }}>
                今日共 {totalCleaningToday} 间清洁任务 · 点击右上角进入清洁管理
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title={
              <span>
                <MedicineBoxOutlined style={{ color: '#eb2f96', marginRight: 8 }} />
                健康跟进单追踪
              </span>
            }
            extra={
              <Button type="link" size="small" onClick={() => onNavigate('health')}>
                去管理 →
              </Button>
            }
          >
            <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
              <Col xs={8}>
                <div style={{ textAlign: 'center', padding: 8, background: 'rgba(250,173,20,0.05)', borderRadius: 4 }}>
                  <MedicineBoxOutlined style={{ fontSize: 20, color: '#fa8c16' }} />
                  <div style={{ fontSize: 18, fontWeight: 600 }}>{followupStats.open}</div>
                  <Tag color="orange" style={{ margin: 0, marginTop: 4 }}>待处理</Tag>
                </div>
              </Col>
              <Col xs={8}>
                <div style={{ textAlign: 'center', padding: 8, background: 'rgba(24,144,255,0.05)', borderRadius: 4 }}>
                  <PlayCircleOutlined style={{ fontSize: 20, color: '#1890ff' }} />
                  <div style={{ fontSize: 18, fontWeight: 600 }}>{followupStats.today}</div>
                  <Tag color="blue" style={{ margin: 0, marginTop: 4 }}>今日新增</Tag>
                </div>
              </Col>
              <Col xs={8}>
                <div style={{ textAlign: 'center', padding: 8, background: 'rgba(82,196,26,0.05)', borderRadius: 4 }}>
                  <CheckCircleOutlined style={{ fontSize: 20, color: '#52c41a' }} />
                  <div style={{ fontSize: 18, fontWeight: 600 }}>{followupStats.closed}</div>
                  <Tag color="green" style={{ margin: 0, marginTop: 4 }}>已关闭</Tag>
                </div>
              </Col>
            </Row>
            {openFollowups.length === 0 ? (
              <Alert type="success" showIcon message="当前无待跟进的健康单" />
            ) : (
              <List
                size="small"
                dataSource={openFollowups}
                renderItem={(item) => {
                  const sMeta = HEALTH_STATUS_LABELS[item.status] || { label: item.status, color: 'default' };
                  return (
                    <List.Item>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                        <MedicineBoxOutlined style={{ color: '#eb2f96' }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 500, fontSize: 13 }}>
                            {item.pet_name}
                            <Tag color="default" style={{ marginLeft: 6, fontSize: 11 }}>
                              {item.family_name}
                            </Tag>
                            <Tag color="red" style={{ fontSize: 11 }}>
                              {ANOMALY_TYPE_LABELS[item.anomaly_type] || item.anomaly_type}
                            </Tag>
                          </div>
                          {item.initial_note && (
                            <div style={{ fontSize: 11, color: '#8c8c8c' }}>
                              {item.initial_note.length > 40 ? item.initial_note.slice(0, 40) + '...' : item.initial_note}
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <Tag color={sMeta.color}>{sMeta.label}</Tag>
                          {item.assigned_to ? (
                            <div style={{ fontSize: 11, color: '#8c8c8c' }}>{item.assigned_to}</div>
                          ) : (
                            <div style={{ fontSize: 11, color: '#fa541c' }}>待指派</div>
                          )}
                        </div>
                      </div>
                    </List.Item>
                  );
                }}
              />
            )}
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <span>
            <WarningOutlined style={{ color: '#fa541c', marginRight: 8 }} />
            喂养异常提醒
          </span>
        }
        style={{ marginBottom: 24 }}
        extra={
          <Space>
            {anomalyCount > 0 && <Tag color="red">{anomalyCount} 条异常</Tag>}
            <Button type="link" size="small" onClick={() => onNavigate('health')}>
              查看跟进 →
            </Button>
          </Space>
        }
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
