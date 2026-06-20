import React, { useState, useEffect } from 'react';
import { Card, DatePicker, Table, Button, Tag, Modal, Form, Input, message, Space, Tooltip } from 'antd';
import { CheckCircleOutlined, CheckCircleFilled } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { FeedingRow } from '../types';

const TIME_SLOT_LABELS: Record<string, string> = {
  morning: '早餐',
  noon: '午餐',
  evening: '晚餐',
};

function FeedingPage() {
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [data, setData] = useState<FeedingRow[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentSlot, setCurrentSlot] = useState<{
    bookingId: string;
    petName: string;
    slot: string;
  } | null>(null);
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
    form.resetFields();
    setModalOpen(true);
  };

  const handleCheckin = async () => {
    if (!currentSlot) return;
    try {
      const values = await form.validateFields();
      await window.api.feedings.checkin(
        currentSlot.bookingId,
        date,
        currentSlot.slot,
        operator,
        values.note
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

  const columns = [
    { title: '宠物', dataIndex: 'pet_name', key: 'pet_name', width: 120 },
    { title: '家庭', dataIndex: 'family_name', key: 'family_name', width: 140 },
    { title: '房间', dataIndex: 'room_name', key: 'room_name', width: 140 },
    ...(['morning', 'noon', 'evening'] as const).map((slotKey) => ({
      title: TIME_SLOT_LABELS[slotKey],
      key: slotKey,
      width: 140,
      render: (_: any, record: FeedingRow) => {
        const slot = record.slots.find((s) => s.key === slotKey);
        if (!slot) return null;
        if (slot.done) {
          return (
            <Tooltip title={slot.record?.note || `操作人: ${slot.record?.operator}`}>
              <Tag color="green" icon={<CheckCircleFilled />}>
                已打卡
                <div style={{ fontSize: 11, color: '#8c8c8c' }}>{slot.record?.created_at?.slice(11, 16)}</div>
              </Tag>
            </Tooltip>
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
        </Form>
      </Modal>
    </div>
  );
}

export default FeedingPage;
