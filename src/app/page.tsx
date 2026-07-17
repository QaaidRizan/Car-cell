'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.css';

interface Sale {
  id: string;
  saleDate: string;
  sellingPrice: string;
  paymentStatus: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID';
  car: {
    make: string;
    model: string;
    registrationNumber: string;
  };
  customer: {
    fullName: string;
  };
}

export default function Dashboard() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      router.push('/login');
    },
  });
  const router = useRouter();

  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');

  const fetchSales = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (paymentStatus) params.append('paymentStatus', paymentStatus);

      const res = await fetch(`/api/sales?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setSales(json.data);
      }
    } catch (error) {
      console.error('Error fetching sales:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated') {
      fetchSales();
    }
  }, [status, search, paymentStatus]);

  if (status === 'loading') return <div className={styles.loading}>Loading...</div>;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Sales Dashboard</h1>
        <Link href="/sales/new" className={styles.addBtn}>
          + Add New Sale
        </Link>
      </header>

      <div className={styles.filters}>
        <input
          type="text"
          placeholder="Search customer, car, VIN..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={styles.searchInput}
        />
        <select
          value={paymentStatus}
          onChange={(e) => setPaymentStatus(e.target.value)}
          className={styles.selectInput}
        >
          <option value="">All Statuses</option>
          <option value="PAID">Paid</option>
          <option value="PARTIALLY_PAID">Partially Paid</option>
          <option value="UNPAID">Unpaid</option>
        </select>
      </div>

      <div className={styles.tableContainer}>
        {loading ? (
          <div className={styles.loading}>Loading sales...</div>
        ) : sales.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No sales recorded yet.</p>
            {!search && !paymentStatus && (
              <Link href="/sales/new" className={styles.addBtn}>
                Add your first sale
              </Link>
            )}
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Car</th>
                <th>Customer</th>
                <th>Selling Price</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <tr key={sale.id} onClick={() => router.push(`/sales/${sale.id}`)}>
                  <td>{new Date(sale.saleDate).toLocaleDateString()}</td>
                  <td>{sale.car.make} {sale.car.model} ({sale.car.registrationNumber})</td>
                  <td>{sale.customer.fullName}</td>
                  <td>LKR {Number(sale.sellingPrice).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
