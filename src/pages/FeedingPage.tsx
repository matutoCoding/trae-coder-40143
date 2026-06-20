import React, { useState, useEffect } from 'react';
import { Card, DatePicker, Table, Button, Tag, Modal, Form, Input, message, Space, Tooltip, Checkbox, Select, Alert } from 'antd';
import { CheckCircleOutlined, CheckCircleFilled, WarningOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { FeedingRow } from '../types';
import { ANOMALY_TYPE_LABELS } from '../types';

const TIME_SLOT_LABELS: Record<string, string> = {
  morning: '早餐',
  noon: '午餐',
  evening: '晚餐',
};

const ANOMALY_OPTIONS = Object.entries(ANOMALY_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

function FeedingPage() {
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [data, setData] = useState<FeedingRow[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentSlot, setCurrentSlot] = useState<{
    bookingId: string;
    petName: string;
    slot: string;
  } | null>(null);
  const [isAnomaly, setIsAnomaly] = useState(false);
  const [anomalyType, setAnomalyType] = useState<string | undefined>(undefined);
  const [form] = Form.useForm();
  const operator = '管理员';

  const loadData = async () => {
    try {
      const list = await window.api.feedings.listByDate(date);
      setData(list);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, [date]);

  const handleSlotClick = (row: FeedingRow, slot: { key: string; label: string; done: boolean }) => {
    if (slot.done) return;
    setCurrentSlot({
      bookingId: row.booking_id,
      petName: row.pet_name,
      slot: slot.key,
    });
    setIsAnomaly(false);
    setAnomalyType(undefined);
    form.resetFields();
    setModalOpen(true);
  };

  const handleCheckin = async () => {
    if (!currentSlot) return;
    try {
      const values = await form.validateFields();
      if (isAnomaly && !anomalyType) {
        message.error('请选择异常类型');
        return;
      }
      await window.api.feedings.checkin(
        currentSlot.bookingId,
        date,
        currentSlot.slot,
        operator,
        values.note,
        isAnomaly,
        isAnomaly ? anomalyType : undefined
      );
      message.success(`${currentSlot.petName} 的${TIME_SLOT_LABELS[currentSlot.slot]}打卡成功`);
      setModalOpen(false);
      loadData();
    } catch (e: any) {
      message.error(e.message || '打卡失败');
    }
  };

  const totalSlots = data.length * 3;
  const doneSlots = data.reduce(
    (acc, row) => acc + row.slots.filter((s) => s.done).length,
    0
  );

  const anomalyRecords: { petName: string; anomalyType: string }[] = [];
  data.forEach((row) => {
    row.slots.forEach((slot) => {
      if (slot.done && slot.record?.is_anomaly === 1) {
        anomalyRecords.push({
          petName: row.pet_name,
          anomalyType: slot.record.anomaly_type,
        });
      }
    });
  });
  const anomalyCount = anomalyRecords.length;

  const columns = [
    { title: '宠物', dataIndex: 'pet_name', key: 'pet_name', width: 120 },
    { title: '家庭', dataIndex: 'family_name', key: 'family_name', width: 140 },
    { title: '房间', dataIndex: 'room_name', key: 'room_name', width: 140 },
    ...(['morning', 'noon', 'evening'] as const).map((slotKey) => ({
      title: TIME_SLOT_LABELS[slotKey],
      key: slotKey,
      width: 160,
      render: (_: any, record: FeedingRow) => {
        const slot = record.slots.find((s) => s.key === slotKey);
        if (!slot) return null;
        if (slot.done) {
          const isAnomalyRecord = slot.record?.is_anomaly === 1;
          return (
            <Space direction="vertical" size={2}>
              <Tooltip title={slot.record?.note || `操作人: ${slot.record?.operator}`}>
                <Tag color={isAnomalyRecord ? 'volcano' : 'green'} icon={<CheckCircleFilled />}>
                  {isAnomalyRecord ? '异常' : '已打卡'}
                  <div style={{ fontSize: 11, color: '#8c8c8c' }}>{slot.record?.created_at?.slice(11, 16)}</div>
                </Tag>
              </Tooltip>
              {isAnomalyRecord && slot.record?.anomaly_type && (
                <Tag color="red">{ANOMALY_TYPE_LABELS[slot.record.anomaly_type] || slot.record.anomaly_type}</Tag>
              )}
            </Space>
          );
        }
        return (
          <Button
            type="dashed"
            icon={<CheckCircleOutlined />}
            onClick={() => handleSlotClick(record, slot)}
            className="feeding-slot"
          >
            打卡
          </Button>
        );
      },
    })),
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 className="page-title" style={{ margin: 0 }}>每日喂养打卡</h2>
        <Space>
          <DatePicker
            value={dayjs(date)}
            onChange={(d) => d && setDate(d.format('YYYY-MM-DD'))}
            allowClear={false}
          />
          <Tag color="blue">
            今日进度: {doneSlots}/{totalSlots}
          </Tag>
        </Space>
      </div>

      {anomalyCount > 0 && (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          style={{ marginBottom: 16 }}
          message={`今日异常上报 ${anomalyCount} 条`}
          description={
            <div>
              {anomalyRecords.map((r, i) => (
                <span key={i}>
                  {i > 0 && '、'}
                  {r.petName}（{ANOMALY_TYPE_LABELS[r.anomalyType] || r.anomalyType}）
                </span>
              ))}
            </div>
          }
        />
      )}

      <Card>
        <Table
          rowKey="booking_id"
          columns={columns}
          dataSource={data}
          pagination={false}
          locale={{ emptyText: '当前无入住宠物' }}
        />
      </Card>

      <Modal
        title={`${currentSlot?.petName} - ${TIME_SLOT_LABELS[currentSlot?.slot || '']} 打卡`}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleCheckin}
        okText="确认打卡"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <div style={{ marginBottom: 12, padding: 12, background: '#fafafa', borderRadius: 4 }}>
            <div>
              日期：<strong>{date}</strong>
            </div>
            <div>
              操作人：<strong>{operator}</strong>
            </div>
          </div>
          <Form.Item label="备注(食量/状态等)" name="note">
            <Input.TextArea rows={3} placeholder="例如：食欲良好，进食正常" />
          </Form.Item>
          <Form.Item>
            <Checkbox
              checked={isAnomaly}
              onChange={(e) => {
                setIsAnomaly(e.target.checked);
                if (!e.target.checked) {
                  setAnomalyType(undefined);
                }
              }}
            >
              异常上报
            </Checkbox>
          </Form.Item>
          {isAnomaly && (
            <Form.Item label="异常类型" required>
              <Select
                value={anomalyType}
                onChange={(val) => setAnomalyType(val)}
                placeholder="请选择异常类型"
                options={ANOMALY_OPTIONS}
                style={{ width: '100%' }}
              />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
}

export default FeedingPage;
