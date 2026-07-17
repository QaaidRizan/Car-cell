'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import styles from './page.module.css';

export default function AddSalePage() {
  const router = useRouter();
  const { status } = useSession({ required: true, onUnauthenticated() { router.push('/login'); } });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Car Details
  const [car, setCar] = useState({ make: '', model: '', year: '', vin: '', registrationNumber: '', color: '', mileage: '', notes: '' });
  
  // Customer Details
  const [customer, setCustomer] = useState({ fullName: '', nicNumber: '', phone: '', email: '', address: '', guarantorName: '', guarantorContact: '' });
  
  // Sale Details
  const [sale, setSale] = useState({ saleDate: new Date().toISOString().split('T')[0], sellingPrice: '', paymentType: 'FULL', notes: '' });
  
  // Installment Plan
  const [plan, setPlan] = useState({ downPayment: '', installmentAmount: '', frequency: 'MONTHLY', customFrequencyDays: '', numberOfInstallments: '', nextDueDate: '' });

  // Finance Detail
  const [finance, setFinance] = useState({ financeCompanyName: '', loanAgreementNumber: '', loanAmount: '', downPayment: '', financeStatus: '', note: '' });

  // Files
  const [files, setFiles] = useState<{ file: File }[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map(f => ({ file: f }));
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const salePayload = {
        car,
        customer,
        sale,
        installmentPlan: sale.paymentType === 'INSTALLMENT' ? plan : undefined,
        financeDetail: sale.paymentType === 'FINANCING' ? finance : undefined,
      };

      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(salePayload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to create sale');
      }

      const { data: newSale } = await res.json();

      // Upload files
      for (const f of files) {
        const formData = new FormData();
        formData.append('file', f.file);
        
        await fetch(`/api/sales/${newSale.id}/documents`, {
          method: 'POST',
          body: formData,
        });
      }

      router.push(`/sales/${newSale.id}`);
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving.');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading') return null;

  const isInstallment = sale.paymentType === 'INSTALLMENT';
  const isFinancing = sale.paymentType === 'FINANCING';

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Add New Sale</h1>
      {error && <div className={styles.error}>{error}</div>}

      <form onSubmit={handleSubmit} className={styles.form}>
        
        {/* Section A: Car */}
        <section className={styles.section}>
          <h2>Section A — Car Details</h2>
          <div className={styles.grid}>
            <div className={styles.inputGroup}>
              <label>Make *</label>
              <input required value={car.make} onChange={e => setCar({...car, make: e.target.value})} />
            </div>
            <div className={styles.inputGroup}>
              <label>Model *</label>
              <input required value={car.model} onChange={e => setCar({...car, model: e.target.value})} />
            </div>
            <div className={styles.inputGroup}>
              <label>Year *</label>
              <input required type="number" value={car.year} onChange={e => setCar({...car, year: e.target.value})} />
            </div>
            <div className={styles.inputGroup}>
              <label>VIN (Chassis No) *</label>
              <input required value={car.vin} onChange={e => setCar({...car, vin: e.target.value})} />
            </div>
            <div className={styles.inputGroup}>
              <label>Registration Number *</label>
              <input required value={car.registrationNumber} onChange={e => setCar({...car, registrationNumber: e.target.value})} />
            </div>
            <div className={styles.inputGroup}>
              <label>Color</label>
              <input value={car.color} onChange={e => setCar({...car, color: e.target.value})} />
            </div>
            <div className={styles.inputGroup}>
              <label>Mileage *</label>
              <input required type="number" value={car.mileage} onChange={e => setCar({...car, mileage: e.target.value})} />
            </div>
          </div>
          <div className={styles.inputGroup}>
            <label>Notes</label>
            <textarea value={car.notes} onChange={e => setCar({...car, notes: e.target.value})} rows={3} />
          </div>
        </section>

        {/* Section B: Customer */}
        <section className={styles.section}>
          <h2>Section B — Customer Details</h2>
          <div className={styles.grid}>
            <div className={styles.inputGroup}>
              <label>Full Name *</label>
              <input required value={customer.fullName} onChange={e => setCustomer({...customer, fullName: e.target.value})} />
            </div>
            <div className={styles.inputGroup}>
              <label>NIC Number *</label>
              <input required value={customer.nicNumber} onChange={e => setCustomer({...customer, nicNumber: e.target.value})} />
            </div>
            <div className={styles.inputGroup}>
              <label>Phone *</label>
              <input required value={customer.phone} onChange={e => setCustomer({...customer, phone: e.target.value})} />
            </div>
            <div className={styles.inputGroup}>
              <label>Email</label>
              <input type="email" value={customer.email} onChange={e => setCustomer({...customer, email: e.target.value})} />
            </div>
          </div>
          <div className={styles.inputGroup}>
            <label>Address</label>
            <textarea value={customer.address} onChange={e => setCustomer({...customer, address: e.target.value})} rows={2} />
          </div>
          {(isInstallment || isFinancing) && (
            <div className={styles.grid}>
              <div className={styles.inputGroup}>
                <label>Guarantor Name</label>
                <input value={customer.guarantorName} onChange={e => setCustomer({...customer, guarantorName: e.target.value})} />
              </div>
              <div className={styles.inputGroup}>
                <label>Guarantor Contact</label>
                <input value={customer.guarantorContact} onChange={e => setCustomer({...customer, guarantorContact: e.target.value})} />
              </div>
            </div>
          )}
        </section>

        {/* Section C: Sale */}
        <section className={styles.section}>
          <h2>Section C — Sale & Payment Details</h2>
          <div className={styles.grid}>
            <div className={styles.inputGroup}>
              <label>Sale Date *</label>
              <input required type="date" value={sale.saleDate} onChange={e => setSale({...sale, saleDate: e.target.value})} />
            </div>
            <div className={styles.inputGroup}>
              <label>Selling Price *</label>
              <input required type="number" step="0.01" value={sale.sellingPrice} onChange={e => setSale({...sale, sellingPrice: e.target.value})} />
            </div>
            <div className={styles.inputGroup}>
              <label>Payment Type *</label>
              <select required value={sale.paymentType} onChange={e => setSale({...sale, paymentType: e.target.value})}>
                <option value="FULL">Full Payment</option>
                <option value="INSTALLMENT">Installment</option>
                <option value="FINANCING">Financing</option>
              </select>
            </div>
          </div>

          {isInstallment && (
            <div className={styles.grid}>
              <div className={styles.inputGroup}>
                <label>Down Payment *</label>
                <input required type="number" step="0.01" value={plan.downPayment} onChange={e => setPlan({...plan, downPayment: e.target.value})} />
              </div>
              <div className={styles.inputGroup}>
                <label>Installment Amount *</label>
                <input required type="number" step="0.01" value={plan.installmentAmount} onChange={e => setPlan({...plan, installmentAmount: e.target.value})} />
              </div>
              <div className={styles.inputGroup}>
                <label>Frequency *</label>
                <select required value={plan.frequency} onChange={e => setPlan({...plan, frequency: e.target.value})}>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="CUSTOM">Custom</option>
                </select>
              </div>
              {plan.frequency === 'CUSTOM' && (
                <div className={styles.inputGroup}>
                  <label>Custom Frequency (Days) *</label>
                  <input required type="number" value={plan.customFrequencyDays} onChange={e => setPlan({...plan, customFrequencyDays: e.target.value})} />
                </div>
              )}
              <div className={styles.inputGroup}>
                <label>No. of Installments *</label>
                <input required type="number" value={plan.numberOfInstallments} onChange={e => setPlan({...plan, numberOfInstallments: e.target.value})} />
              </div>
              <div className={styles.inputGroup}>
                <label>Next Due Date *</label>
                <input required type="date" value={plan.nextDueDate} onChange={e => setPlan({...plan, nextDueDate: e.target.value})} />
              </div>
            </div>
          )}

          {isFinancing && (
            <div className={styles.grid}>
              <div className={styles.inputGroup}>
                <label>Finance Company Name</label>
                <input value={finance.financeCompanyName} onChange={e => setFinance({...finance, financeCompanyName: e.target.value})} />
              </div>
              <div className={styles.inputGroup}>
                <label>Loan/Agreement Number</label>
                <input value={finance.loanAgreementNumber} onChange={e => setFinance({...finance, loanAgreementNumber: e.target.value})} />
              </div>
              <div className={styles.inputGroup}>
                <label>Loan Amount</label>
                <input type="number" step="0.01" value={finance.loanAmount} onChange={e => setFinance({...finance, loanAmount: e.target.value})} />
              </div>
              <div className={styles.inputGroup}>
                <label>Down Payment</label>
                <input type="number" step="0.01" value={finance.downPayment} onChange={e => setFinance({...finance, downPayment: e.target.value})} />
              </div>
              <div className={styles.inputGroup}>
                <label>Finance Status</label>
                <input value={finance.financeStatus} onChange={e => setFinance({...finance, financeStatus: e.target.value})} placeholder="e.g. Approved, Pending..." />
              </div>
              <div className={styles.inputGroup}>
                <label>Note</label>
                <input value={finance.note} onChange={e => setFinance({...finance, note: e.target.value})} />
              </div>
            </div>
          )}

          <div className={styles.inputGroup}>
            <label>Sale Notes</label>
            <textarea value={sale.notes} onChange={e => setSale({...sale, notes: e.target.value})} rows={3} />
          </div>
        </section>

        {/* Section D: Documents */}
        <section className={styles.section}>
          <h2>Section D — Documents & Images</h2>
          <div className={styles.fileUpload}>
            <input type="file" multiple accept="image/*,.pdf" onChange={handleFileChange} />
          </div>
          {files.length > 0 && (
            <div className={styles.fileList}>
              {files.map((f, i) => (
                <div key={i} className={styles.fileItem}>
                  <span className={styles.fileName}>{f.file.name}</span>

                  <button type="button" onClick={() => removeFile(i)} className={styles.removeBtn}>Remove</button>
                </div>
              ))}
            </div>
          )}
        </section>

        <button type="submit" className={styles.submitBtn} disabled={loading}>
          {loading ? 'Saving...' : 'Save Sale'}
        </button>
      </form>
    </div>
  );
}
