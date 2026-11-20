import { useEffect, useState } from 'react';
import {
  Typography,
  Table,
  Button,
  Tag,
  message,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import {
  userPackageApi,
  type PaymentRecord,
} from '../services/userPackageApi';

const { Title } = Typography;

const statusColor: Record<string, string> = {
  PENDING: 'orange',
  SUCCESS: 'green',
  FAILED: 'red',
  EXPIRED: 'default',
};

const formatAmount = (amount: number, currency: string) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency }).format(amount);

const formatDate = (date: string | null) =>
  date ? new Date(date).toLocaleDateString('id-ID', { dateStyle: 'medium' }) : '-';

const getColumns = (
  onContinue: (record: PaymentRecord) => void,
  continuingId: string | null,
): ColumnsType<PaymentRecord> => [
  {
    title: 'Order ID',
    dataIndex: 'orderId',
    key: 'orderId',
    ellipsis: true,
    width: 220,
  },
  {
    title: 'Amount',
    key: 'amount',
    render: (_, record) => formatAmount(record.amount, record.currency),
  },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    render: (status: string) => (
      <Tag color={statusColor[status] ?? 'default'}>{status}</Tag>
    ),
  },
  {
    title: 'Payment Type',
    dataIndex: 'paymentType',
    key: 'paymentType',
    render: (val: string | null) => val ?? '-',
  },
  {
    title: 'Paid At',
    dataIndex: 'paidAt',
    key: 'paidAt',
    render: (val: string | null) => formatDate(val),
  },
  {
    title: 'Created At',
    dataIndex: 'createdAt',
    key: 'createdAt',
    render: (val: string) => formatDate(val),
  },
  {
    title: 'Action',
    key: 'action',
    render: (_, record) =>
      record.status === 'PENDING' && record.packageId ? (
        <Button
          type="primary"
          size="small"
          loading={continuingId === record.id}
          onClick={() => onContinue(record)}
        >
          Lanjutkan Pembayaran
        </Button>
      ) : null,
  },
];

const UserPaymentPage = () => {
  const navigate = useNavigate();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const history = await userPackageApi.getPaymentHistory();
      setPayments(history);
    } catch {
      message.error('Gagal memuat riwayat pembayaran');
    } finally {
      setLoadingHistory(false);
    }
  };

  const [continuingId, setContinuingId] = useState<string | null>(null);

  // Resume an unfinished checkout. Backend reuses the same DANA link while it is
  // still valid (~20 min) and creates a fresh order otherwise.
  const handleContinue = async (record: PaymentRecord) => {
    setContinuingId(record.id);
    try {
      // Avoid paying twice if it was actually paid but not synced yet
      const { status } = await userPackageApi.checkPaymentStatus(record.orderId).catch(() => ({ status: undefined }));
      if (status && status !== 'PENDING') {
        message.info(status === 'SUCCESS' ? 'Pembayaran ini sudah berhasil' : `Status pembayaran: ${status}`);
        fetchHistory();
        return;
      }

      const order = await userPackageApi.createOrder(record.packageId!);
      if (!order.redirectUrl) {
        message.error('Gagal membuat ulang link pembayaran');
        return;
      }
      message.info('Mengalihkan ke halaman pembayaran DANA...');
      window.location.href = order.redirectUrl;
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Gagal melanjutkan pembayaran');
    } finally {
      setContinuingId(null);
    }
  };

  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const returnedOrderId = searchParams.get('orderId');
    if (!returnedOrderId) {
      fetchHistory();
      return;
    }

    // Back from DANA checkout: sync status (webhook may not have arrived yet)
    userPackageApi
      .checkPaymentStatus(returnedOrderId)
      .then(({ status }) => {
        if (status === 'SUCCESS') message.success('Pembayaran berhasil, paket sudah aktif');
        else if (status === 'PENDING') message.info('Pembayaran belum selesai');
        else if (status) message.warning(`Status pembayaran: ${status}`);
      })
      .catch(() => message.warning('Gagal memeriksa status pembayaran'))
      .finally(() => {
        setSearchParams({}, { replace: true });
        fetchHistory();
      });
  }, []);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>Payment</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/user/packages')}
        >
          Add New Package
        </Button>
      </div>

      <Table<PaymentRecord>
        columns={getColumns(handleContinue, continuingId)}
        dataSource={payments}
        rowKey="id"
        loading={loadingHistory}
        pagination={{ pageSize: 10 }}
        scroll={{ x: 900 }}
      />
    </>
  );
};

export default UserPaymentPage;
