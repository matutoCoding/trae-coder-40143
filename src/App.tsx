import React, { useState, useEffect } from 'react';
import { Layout, Menu, Badge, Dropdown, Button, message, Select, Space, Tag } from 'antd';
import {
  HomeOutlined,
  CalendarOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  CoffeeOutlined,
  BellOutlined,
  SettingOutlined,
  ScissorOutlined,
  MedicineBoxOutlined,
} from '@ant-design/icons';
import DashboardPage from './pages/DashboardPage';
import SchedulePage from './pages/SchedulePage';
import FamiliesPage from './pages/FamiliesPage';
import WaitlistPage from './pages/WaitlistPage';
import FeedingPage from './pages/FeedingPage';
import RoomsPage from './pages/RoomsPage';
import CleaningsPage from './pages/CleaningsPage';
import HealthPage from './pages/HealthPage';
import type { Notification } from './types';

const { Header, Content, Sider } = Layout;
const { Option } = Select;

const NOTIF_TYPE_LABELS: Record<string, string> = {
  all: '全部',
  waitlist_confirm_pending: '候补确认',
  waitlist_confirmed: '候补成功',
  waitlist_declined: '候补放弃',
  waitlist_confirm_expired: '候补超时',
  feeding_anomaly: '喂养异常',
  health_followup: '健康跟进',
  health_closed: '健康关闭',
  room_cleaning: '房间清洁',
  room_cleaning_done: '清洁完成',
  cleaning_overdue: '清洁超时',
  booking_expired: '预订过期',
  other: '其他通知',
};

function App() {
  const [activeKey, setActiveKey] = useState('dashboard');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifFilter, setNotifFilter] = useState<string>('all');
  const [handledFilter, setHandledFilter] = useState<boolean | 'all'>('all');

  const loadNotifications = async () => {
    try {
      const params: any = {};
      if (notifFilter !== 'all') params.type = notifFilter;
      if (handledFilter !== 'all') params.handled = handledFilter;
      const list = await window.api.notifications.list(params);
      setNotifications(list);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadNotifications();
    const timer = setInterval(loadNotifications, 30000);
    return () => clearInterval(timer);
  }, [activeKey, notifFilter, handledFilter]);

  const unreadCount = notifications.filter((n) => n.is_read === 0).length;
  const unhandledCount = notifications.filter((n) => n.is_handled === 0 && n.is_read === 0).length;

  const markAllRead = async () => {
    await window.api.notifications.markAllRead();
    loadNotifications();
    message.success('全部已读');
  };

  const markHandled = async (id: string) => {
    await window.api.notifications.markHandled(id);
    loadNotifications();
    message.success('已标记为已处理');
  };

  const markAllHandledOfType = async (type: string) => {
    await window.api.notifications.markHandledByType(type);
    loadNotifications();
    message.success('该类通知全部标记已处理');
  };

  const notificationMenu = {
    items: [
      {
        key: 'filters',
        label: (
          <div style={{ padding: '8px 4px', borderBottom: '1px solid #f0f0f0' }}>
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>系统通知</strong>
                <Space>
                  <Button type="link" size="small" onClick={markAllRead}>全部已读</Button>
                  {notifFilter !== 'all' && (
                    <Button type="link" size="small" onClick={() => markAllHandledOfType(notifFilter)}>
                      标记该类已处理
                    </Button>
                  )}
                </Space>
              </div>
              <Space>
                <Select size="small" value={notifFilter} onChange={(v) => setNotifFilter(v)} style={{ width: 150 }}>
                  <Option value="all">全部类型</Option>
                  {Object.keys(NOTIF_TYPE_LABELS).filter(k => k !== 'all').map((k) => (
                    <Option key={k} value={k}>{NOTIF_TYPE_LABELS[k] || k}</Option>
                  ))}
                </Select>
                <Select size="small" value={handledFilter} onChange={(v) => setHandledFilter(v)} style={{ width: 120 }}>
                  <Option value="all">全部状态</Option>
                  <Option value={false}>未处理</Option>
                  <Option value={true}>已处理</Option>
                </Select>
              </Space>
            </Space>
          </div>
        ),
        disabled: true,
      },
      ...notifications.slice(0, 12).map((n) => ({
        key: n.id,
        label: (
          <div style={{ padding: '8px 4px', borderBottom: '1px solid #f0f0f0', maxWidth: 380 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontWeight: n.is_read ? 400 : 600 }}>{n.title}</span>
                  <Tag style={{ fontSize: 10 }} color={n.is_handled ? 'default' : 'orange'}>
                    {n.is_handled ? '已处理' : '未处理'}
                  </Tag>
                  <Tag style={{ fontSize: 10 }} color="blue">{NOTIF_TYPE_LABELS[n.type] || n.type}</Tag>
                </div>
                <div style={{ color: '#8c8c8c', fontSize: 12, marginTop: 4 }}>{n.content}</div>
                <div style={{ color: '#bfbfbf', fontSize: 11, marginTop: 4 }}>{n.created_at}</div>
              </div>
              {!n.is_handled && (
                <Button type="link" size="small" onClick={(e) => { e.stopPropagation(); markHandled(n.id); }}>
                  标记处理
                </Button>
              )}
            </div>
          </div>
        ),
      })),
      notifications.length === 0
        ? { key: 'empty', label: <div style={{ padding: 20, color: '#bfbfbf' }}>暂无通知</div>, disabled: true }
        : null,
    ].filter(Boolean) as any[],
  };

  const menuItems = [
    { key: 'dashboard', icon: <HomeOutlined />, label: '控制台' },
    { key: 'schedule', icon: <CalendarOutlined />, label: '房间排期' },
    { key: 'rooms', icon: <SettingOutlined />, label: '宠物间管理' },
    { key: 'cleanings', icon: <ScissorOutlined />, label: '房间清洁' },
    { key: 'health', icon: <MedicineBoxOutlined />, label: '健康跟进' },
    { key: 'families', icon: <TeamOutlined />, label: '家庭与额度' },
    { key: 'waitlist', icon: <ClockCircleOutlined />, label: '候补队列' },
    { key: 'feeding', icon: <CoffeeOutlined />, label: '喂养打卡' },
  ];

  const renderPage = () => {
    switch (activeKey) {
      case 'dashboard':
        return <DashboardPage onNavigate={setActiveKey} />;
      case 'schedule':
        return <SchedulePage />;
      case 'rooms':
        return <RoomsPage />;
      case 'cleanings':
        return <CleaningsPage />;
      case 'health':
        return <HealthPage />;
      case 'families':
        return <FamiliesPage />;
      case 'waitlist':
        return <WaitlistPage />;
      case 'feeding':
        return <FeedingPage />;
      default:
        return <DashboardPage onNavigate={setActiveKey} />;
    }
  };

  return (
    <Layout style={{ height: '100vh' }}>
      <Header
        style={{
          background: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 28 }}>🐾</span>
          <h1 style={{ color: 'white', margin: 0, fontSize: 20, fontWeight: 600 }}>
            宠物寄养酒店管理系统
          </h1>
        </div>
        <Dropdown menu={notificationMenu} placement="bottomRight" trigger={['click']}>
          <Badge count={unhandledCount || unreadCount} offset={[-4, 4]}>
            <Button
              type="text"
              icon={<BellOutlined style={{ color: 'white', fontSize: 18 }} />}
              style={{ color: 'white' }}
            />
          </Badge>
        </Dropdown>
      </Header>
      <Layout>
        <Sider width={200} style={{ background: '#fff', borderRight: '1px solid #f0f0f0' }}>
          <Menu
            mode="inline"
            selectedKeys={[activeKey]}
            onClick={(e) => setActiveKey(e.key)}
            style={{ height: '100%', borderRight: 0, paddingTop: 12 }}
            items={menuItems}
          />
        </Sider>
        <Layout style={{ background: '#f0f2f5' }}>
          <Content style={{ padding: 20, overflow: 'auto' }}>{renderPage()}</Content>
        </Layout>
      </Layout>
    </Layout>
  );
}

export default App;
