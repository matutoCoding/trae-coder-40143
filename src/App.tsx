import React, { useState, useEffect } from 'react';
import { Layout, Menu, Badge, Dropdown, Button, message } from 'antd';
import {
  HomeOutlined,
  CalendarOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  CoffeeOutlined,
  BellOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import DashboardPage from './pages/DashboardPage';
import SchedulePage from './pages/SchedulePage';
import FamiliesPage from './pages/FamiliesPage';
import WaitlistPage from './pages/WaitlistPage';
import FeedingPage from './pages/FeedingPage';
import RoomsPage from './pages/RoomsPage';
import type { Notification } from './types';

const { Header, Content, Sider } = Layout;

function App() {
  const [activeKey, setActiveKey] = useState('dashboard');
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const loadNotifications = async () => {
    try {
      const list = await window.api.notifications.list();
      setNotifications(list);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadNotifications();
    const timer = setInterval(loadNotifications, 30000);
    return () => clearInterval(timer);
  }, [activeKey]);

  const unreadCount = notifications.filter((n) => n.is_read === 0).length;

  const markAllRead = async () => {
    await window.api.notifications.markAllRead();
    loadNotifications();
    message.success('全部已读');
  };

  const notificationMenu = {
    items: [
      {
        key: 'header',
        label: (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px' }}>
            <strong>系统通知</strong>
            <Button type="link" size="small" onClick={markAllRead}>
              全部已读
            </Button>
          </div>
        ),
        disabled: true,
      },
      ...notifications.slice(0, 8).map((n) => ({
        key: n.id,
        label: (
          <div style={{ padding: '8px 4px', borderBottom: '1px solid #f0f0f0', maxWidth: 320 }}>
            <div style={{ fontWeight: n.is_read ? 400 : 600 }}>{n.title}</div>
            <div style={{ color: '#8c8c8c', fontSize: 12, marginTop: 4 }}>{n.content}</div>
            <div style={{ color: '#bfbfbf', fontSize: 11, marginTop: 4 }}>{n.created_at}</div>
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
          <Badge count={unreadCount} offset={[-4, 4]}>
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
