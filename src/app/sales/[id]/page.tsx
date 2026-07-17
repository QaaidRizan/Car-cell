'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import styles from './page.module.css';



export default function SaleDetailPage() {
  const router = useRouter();
  const { id } = useParams();
  const { status } = useSession({ required: true, onUnauthenticated() { router.push('/login'); } });

  const [sale, setSale] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showAddPayment, setShowAddPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentNotes, setPaymentNotes] = useState('');

  const [deleting, setDeleting] = useState(false);

  // Edit States
  const [editSection, setEditSection] = useState<'car' | 'customer' | 'pricing' | 'documents' | 'finance' | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  // Document Edit States
  const [newDocs, setNewDocs] = useState<{ file: File }[]>([]);
  const [deletedDocIds, setDeletedDocIds] = useState<string[]>([]);
  const [docView, setDocView] = useState<'folders' | 'images' | 'documents'>('folders');

  const fetchSale = async () => {
    try {
      const res = await fetch(`/api/sales/${id}`);
      if (!res.ok) throw new Error('Failed to fetch sale');
      const json = await res.json();
      setSale(json.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated') {
      fetchSale();
    }
  }, [status, id]);

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/sales/${id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseFloat(paymentAmount), paymentDate, notes: paymentNotes }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      setShowAddPayment(false);
      setPaymentAmount('');
      setPaymentNotes('');
      fetchSale();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this sale? This action cannot be undone.')) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/sales/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      router.push('/');
    } catch (err: any) {
      alert(err.message);
      setDeleting(false);
    }
  };

  // --- EDITING LOGIC ---

  const startEdit = (section: 'car' | 'customer' | 'pricing' | 'documents' | 'finance') => {
    setEditSection(section);
    if (section === 'car') setEditForm({ ...sale.car });
    if (section === 'customer') setEditForm({ ...sale.customer });
    if (section === 'pricing') setEditForm({
      sellingPrice: sale.sellingPrice,
      paymentType: sale.paymentType,
      notes: sale.notes || '',
    });
    if (section === 'documents') {
      setNewDocs([]);
      setDeletedDocIds([]);
    }
    if (section === 'finance') setEditForm({ ...(sale.financeDetail || {}) });
  };

  const cancelEdit = () => {
    setEditSection(null);
    setEditForm({});
    setNewDocs([]);
    setDeletedDocIds([]);
  };

  const handleSaveSection = async () => {
    setSaving(true);
    try {
      const formData = new FormData();
      const saleData: any = {};

      if (editSection === 'car') saleData.car = editForm;
      if (editSection === 'customer') saleData.customer = editForm;
      if (editSection === 'pricing') saleData.sale = editForm;
      if (editSection === 'finance') saleData.financeDetail = editForm;
      if (editSection === 'documents') {
        saleData.deletedDocumentIds = deletedDocIds;
        newDocs.forEach((doc, index) => {
          formData.append(`file_${index}`, doc.file);
        });
      }

      formData.append('saleData', JSON.stringify(saleData));

      const res = await fetch(`/api/sales/${id}`, {
        method: 'PUT',
        body: formData
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to update');
      }

      await fetchSale();
      cancelEdit();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (status === 'loading' || loading) return <div className={styles.loading}>Loading...</div>;
  if (error) return <div className={styles.error}>{error}</div>;
  if (!sale) return <div className={styles.error}>Sale not found</div>;

  const isInstallment = sale.paymentType === 'INSTALLMENT';
  const isFinancing = sale.paymentType === 'FINANCING';

  // Filter docs and exclude deleted ones from UI during edit mode
  const activeDocs = sale.documents.filter((d: any) => !deletedDocIds.includes(d.id));
  const images = activeDocs.filter((d: any) => d.fileType === 'IMAGE');
  const pdfs = activeDocs.filter((d: any) => d.fileType === 'PDF');

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Sale Details</h1>
        <div className={styles.headerActions}>
          <button className={styles.deleteBtn} onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete Sale'}
          </button>
        </div>
      </header>

      <div className={styles.gridContainer}>
        {/* Left Column */}
        <div className={styles.leftCol}>

          {/* CAR DETAILS */}
          <section className={styles.card}>
            <div className={styles.sectionHeader}>
              <h2>Car Details</h2>
              {editSection !== 'car' && (
                <button className={styles.editBtn} onClick={() => startEdit('car')}>Edit</button>
              )}
            </div>

            {editSection === 'car' ? (
              <div className={styles.editForm}>
                <div className={styles.inputGroup}><label>Make</label><input value={editForm.make || ''} onChange={e => setEditForm({ ...editForm, make: e.target.value })} /></div>
                <div className={styles.inputGroup}><label>Model</label><input value={editForm.model || ''} onChange={e => setEditForm({ ...editForm, model: e.target.value })} /></div>
                <div className={styles.inputGroup}><label>Year</label><input type="number" value={editForm.year || ''} onChange={e => setEditForm({ ...editForm, year: e.target.value })} /></div>
                <div className={styles.inputGroup}><label>VIN</label><input value={editForm.vin || ''} onChange={e => setEditForm({ ...editForm, vin: e.target.value })} /></div>
                <div className={styles.inputGroup}><label>Registration</label><input value={editForm.registrationNumber || ''} onChange={e => setEditForm({ ...editForm, registrationNumber: e.target.value })} /></div>
                <div className={styles.inputGroup}><label>Color</label><input value={editForm.color || ''} onChange={e => setEditForm({ ...editForm, color: e.target.value })} /></div>
                <div className={styles.inputGroup}><label>Mileage</label><input type="number" value={editForm.mileage || ''} onChange={e => setEditForm({ ...editForm, mileage: e.target.value })} /></div>
                <div className={styles.inputGroup} style={{ gridColumn: '1 / -1' }}><label>Notes</label><textarea value={editForm.notes || ''} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} /></div>
                <div className={styles.formActions} style={{ gridColumn: '1 / -1' }}>
                  <button onClick={cancelEdit} disabled={saving} className={styles.cancelBtn}>Cancel</button>
                  <button onClick={handleSaveSection} disabled={saving} className={styles.saveBtn}>{saving ? 'Saving...' : 'Save'}</button>
                </div>
              </div>
            ) : (
              <div className={styles.infoGrid}>
                <div><label>Make/Model:</label> {sale.car.make} {sale.car.model}</div>
                <div><label>Year:</label> {sale.car.year}</div>
                <div><label>Registration:</label> {sale.car.registrationNumber}</div>
                <div><label>VIN:</label> {sale.car.vin}</div>
                <div><label>Color:</label> {sale.car.color || '-'}</div>
                <div><label>Mileage:</label> {sale.car.mileage}</div>
                <div style={{ gridColumn: '1 / -1' }}><label>Notes:</label> {sale.car.notes || '-'}</div>
              </div>
            )}
          </section>

          {/* CUSTOMER DETAILS */}
          <section className={styles.card}>
            <div className={styles.sectionHeader}>
              <h2>Customer Details</h2>
              {editSection !== 'customer' && (
                <button className={styles.editBtn} onClick={() => startEdit('customer')}>Edit</button>
              )}
            </div>

            {editSection === 'customer' ? (
              <div className={styles.editForm}>
                <div className={styles.inputGroup}><label>Full Name</label><input value={editForm.fullName || ''} onChange={e => setEditForm({ ...editForm, fullName: e.target.value })} /></div>
                <div className={styles.inputGroup}><label>NIC</label><input value={editForm.nicNumber || ''} onChange={e => setEditForm({ ...editForm, nicNumber: e.target.value })} /></div>
                <div className={styles.inputGroup}><label>Phone</label><input value={editForm.phone || ''} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} /></div>
                <div className={styles.inputGroup}><label>Email</label><input value={editForm.email || ''} onChange={e => setEditForm({ ...editForm, email: e.target.value })} /></div>
                <div className={styles.inputGroup} style={{ gridColumn: '1 / -1' }}><label>Address</label><textarea value={editForm.address || ''} onChange={e => setEditForm({ ...editForm, address: e.target.value })} /></div>
                <div className={styles.inputGroup}><label>Guarantor Name</label><input value={editForm.guarantorName || ''} onChange={e => setEditForm({ ...editForm, guarantorName: e.target.value })} /></div>
                <div className={styles.inputGroup}><label>Guarantor Contact</label><input value={editForm.guarantorContact || ''} onChange={e => setEditForm({ ...editForm, guarantorContact: e.target.value })} /></div>
                <div className={styles.formActions} style={{ gridColumn: '1 / -1' }}>
                  <button onClick={cancelEdit} disabled={saving} className={styles.cancelBtn}>Cancel</button>
                  <button onClick={handleSaveSection} disabled={saving} className={styles.saveBtn}>{saving ? 'Saving...' : 'Save'}</button>
                </div>
              </div>
            ) : (
              <div className={styles.infoGrid}>
                <div><label>Name:</label> {sale.customer.fullName}</div>
                <div><label>NIC:</label> {sale.customer.nicNumber}</div>
                <div><label>Phone:</label> {sale.customer.phone}</div>
                <div><label>Email:</label> {sale.customer.email || '-'}</div>
                <div style={{ gridColumn: '1 / -1' }}><label>Address:</label> {sale.customer.address || '-'}</div>
                {sale.customer.guarantorName && (
                  <>
                    <div><label>Guarantor:</label> {sale.customer.guarantorName}</div>
                    <div><label>Guarantor Contact:</label> {sale.customer.guarantorContact}</div>
                  </>
                )}
              </div>
            )}
          </section>
        </div>

        {/* Right Column */}
        <div className={styles.rightCol}>

          {/* PRICING & PAYMENT TYPE */}
          <section className={styles.card}>
            <div className={styles.sectionHeader}>
              <h2>Payment Summary</h2>
              {editSection !== 'pricing' && (
                <button className={styles.editBtn} onClick={() => startEdit('pricing')}>Edit</button>
              )}
            </div>

            {editSection === 'pricing' ? (
              <div className={styles.editForm} style={{ gridTemplateColumns: '1fr' }}>
                <div className={styles.inputGroup}>
                  <label>Selling Price</label>
                  <input type="number" step="0.01" value={editForm.sellingPrice || ''} onChange={e => setEditForm({ ...editForm, sellingPrice: e.target.value })} />
                </div>
                <div className={styles.inputGroup}>
                  <label>Sale Notes</label>
                  <textarea value={editForm.notes || ''} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} />
                </div>
                <div className={styles.formActions}>
                  <button onClick={cancelEdit} disabled={saving} className={styles.cancelBtn}>Cancel</button>
                  <button onClick={handleSaveSection} disabled={saving} className={styles.saveBtn}>{saving ? 'Saving...' : 'Save'}</button>
                </div>
              </div>
            ) : (
              <>
                <div className={styles.paymentSummary}>
                  <div className={styles.summaryRow}>
                    <span>Selling Price</span>
                    <span className={styles.amount}>LKR {Number(sale.sellingPrice).toLocaleString()}</span>
                  </div>
                </div>

                {isInstallment && sale.installmentPlan && (
                  <div className={styles.installmentInfo}>
                    <h3>Installment Plan</h3>
                    <p>Down Payment: LKR {Number(sale.installmentPlan.downPayment).toLocaleString()}</p>
                    <p>{sale.installmentPlan.numberOfInstallments} installments of LKR {Number(sale.installmentPlan.installmentAmount).toLocaleString()}</p>
                    <p>Frequency: {sale.installmentPlan.frequency}</p>
                  </div>
                )}
              </>
            )}
          </section>

          {/* FINANCE DETAILS */}
          {isFinancing && (
            <section className={styles.card}>
              <div className={styles.sectionHeader}>
                <h2>Finance Details</h2>
                {editSection !== 'finance' && (
                  <button className={styles.editBtn} onClick={() => startEdit('finance')}>Edit</button>
                )}
              </div>

              {editSection === 'finance' ? (
                <div className={styles.editForm}>
                  <div className={styles.inputGroup}>
                    <label>Company Name</label>
                    <input value={editForm.financeCompanyName || ''} onChange={e => setEditForm({ ...editForm, financeCompanyName: e.target.value })} />
                  </div>
                  <div className={styles.inputGroup}>
                    <label>Loan Number</label>
                    <input value={editForm.loanAgreementNumber || ''} onChange={e => setEditForm({ ...editForm, loanAgreementNumber: e.target.value })} />
                  </div>
                  <div className={styles.inputGroup}>
                    <label>Loan Amount</label>
                    <input type="number" step="0.01" value={editForm.loanAmount || ''} onChange={e => setEditForm({ ...editForm, loanAmount: e.target.value })} />
                  </div>
                  <div className={styles.inputGroup}>
                    <label>Down Payment</label>
                    <input type="number" step="0.01" value={editForm.downPayment || ''} onChange={e => setEditForm({ ...editForm, downPayment: e.target.value })} />
                  </div>
                  <div className={styles.inputGroup}>
                    <label>Status</label>
                    <input value={editForm.financeStatus || ''} onChange={e => setEditForm({ ...editForm, financeStatus: e.target.value })} />
                  </div>
                  <div className={styles.inputGroup} style={{ gridColumn: '1 / -1' }}>
                    <label>Note</label>
                    <input value={editForm.note || ''} onChange={e => setEditForm({ ...editForm, note: e.target.value })} />
                  </div>
                  <div className={styles.formActions} style={{ gridColumn: '1 / -1' }}>
                    <button onClick={cancelEdit} disabled={saving} className={styles.cancelBtn}>Cancel</button>
                    <button onClick={handleSaveSection} disabled={saving} className={styles.saveBtn}>{saving ? 'Saving...' : 'Save'}</button>
                  </div>
                </div>
              ) : (
                <div className={styles.infoGrid}>
                  <div><label>Company Name:</label> {sale.financeDetail?.financeCompanyName || '-'}</div>
                  <div><label>Loan Number:</label> {sale.financeDetail?.loanAgreementNumber || '-'}</div>
                  <div><label>Loan Amount:</label> {sale.financeDetail?.loanAmount ? `LKR ${Number(sale.financeDetail.loanAmount).toLocaleString()}` : '-'}</div>
                  <div><label>Down Payment:</label> {sale.financeDetail?.downPayment ? `LKR ${Number(sale.financeDetail.downPayment).toLocaleString()}` : '-'}</div>
                  <div><label>Status:</label> {sale.financeDetail?.financeStatus || '-'}</div>
                  <div style={{ gridColumn: '1 / -1' }}><label>Note:</label> {sale.financeDetail?.note || '-'}</div>
                </div>
              )}
            </section>
          )}

          {/* PAYMENT HISTORY */}
          <section className={styles.card}>
            <div className={styles.sectionHeader}>
              <h2>Payment History</h2>
              {sale.outstandingBalance > 0 && !showAddPayment && (
                <button className={styles.addPaymentBtn} onClick={() => setShowAddPayment(true)}>
                  + Add Payment
                </button>
              )}
            </div>

            {showAddPayment && (
              <form onSubmit={handleAddPayment} className={styles.addPaymentForm}>
                <h4>Record New Payment</h4>
                <div className={styles.inputGroup}>
                  <label>Amount</label>
                  <input required type="number" step="0.01" max={sale.outstandingBalance} value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} />
                </div>
                <div className={styles.inputGroup}>
                  <label>Date</label>
                  <input required type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
                </div>
                <div className={styles.inputGroup}>
                  <label>Notes</label>
                  <input value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} />
                </div>
                <div className={styles.formActions}>
                  <button type="button" onClick={() => setShowAddPayment(false)} className={styles.cancelBtn}>Cancel</button>
                  <button type="submit" className={styles.saveBtn}>Save</button>
                </div>
              </form>
            )}

            <div className={styles.historyTable}>
              {sale.payments.length === 0 ? (
                <p className={styles.empty}>No payments recorded.</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sale.payments.map((p: any) => (
                      <tr key={p.id}>
                        <td>{new Date(p.paymentDate).toLocaleDateString()}</td>
                        <td>LKR {Number(p.amount).toLocaleString()}</td>
                        <td>{p.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* DOCUMENTS */}
      <section className={styles.card}>
        <div className={styles.sectionHeader}>
          <h2>Documents & Images</h2>
          {editSection !== 'documents' && (
            <button className={styles.editBtn} onClick={() => startEdit('documents')}>Edit Documents</button>
          )}
        </div>

        {editSection === 'documents' && (
          <div className={styles.editDocsContainer}>
            <p className={styles.helpText}>Click the 'X' to mark a document for deletion. Add new documents below.</p>

            {/* New Documents Uploader */}
            <div className={styles.newDocUploader}>
              <h4>Add New Documents</h4>
              <input
                type="file"
                multiple
                onChange={(e) => {
                  if (e.target.files) {
                    const filesArr = Array.from(e.target.files);
                    setNewDocs(prev => [...prev, ...filesArr.map(f => ({ file: f }))]);
                  }
                }}
              />
              {newDocs.length > 0 && (
                <div className={styles.newDocsList}>
                  {newDocs.map((doc, idx) => (
                    <div key={idx} className={styles.newDocRow}>
                      <span className={styles.newDocName}>{doc.file.name}</span>

                      <button type="button" onClick={() => setNewDocs(newDocs.filter((_, i) => i !== idx))} className={styles.removeNewDocBtn}>&times;</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.formActions} style={{ marginTop: '1rem', justifyContent: 'flex-start' }}>
              <button onClick={handleSaveSection} disabled={saving} className={styles.saveBtn}>{saving ? 'Saving...' : 'Save Document Changes'}</button>
              <button onClick={cancelEdit} disabled={saving} className={styles.cancelBtn}>Cancel</button>
            </div>
            <hr className={styles.divider} />
          </div>
        )}

        {/* Existing Documents Render */}
        <div className={editSection === 'documents' ? styles.editingDocsView : ''}>
          {docView === 'folders' && (
            <div className={styles.folderGrid}>
              <div className={styles.folderCard} onClick={() => setDocView('images')}>
                <span className={styles.folderIcon}>📁</span>
                <span className={styles.folderName}>Images ({images.length})</span>
              </div>
              <div className={styles.folderCard} onClick={() => setDocView('documents')}>
                <span className={styles.folderIcon}>📁</span>
                <span className={styles.folderName}>Documents ({pdfs.length})</span>
              </div>
            </div>
          )}

          {docView === 'images' && (
            <div className={styles.docSection}>
              <div className={styles.viewHeader}>
                <button onClick={() => setDocView('folders')} className={styles.backBtn}>&larr; Back</button>
                <h3>Images</h3>
              </div>
              {images.length > 0 ? (
                <div className={styles.imageGrid}>
                  {images.map((img: any) => (
                    <div key={img.id} className={styles.imageItem}>
                      <img src={img.fileUrl} alt={img.originalFileName} />
                      {editSection === 'documents' && (
                        <button className={styles.deleteDocBtn} onClick={() => setDeletedDocIds([...deletedDocIds, img.id])}>&times;</button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.empty}>No images available.</p>
              )}
            </div>
          )}

          {docView === 'documents' && (
            <div className={styles.docSection}>
              <div className={styles.viewHeader}>
                <button onClick={() => setDocView('folders')} className={styles.backBtn}>&larr; Back</button>
                <h3>Documents</h3>
              </div>
              {pdfs.length > 0 ? (
                <div className={styles.pdfList}>
                  {pdfs.map((pdf: any) => (
                    <div key={pdf.id} className={styles.pdfItemContainer}>
                      <a href={pdf.fileUrl} target="_blank" rel="noopener noreferrer" className={styles.pdfItem}>
                        <span className={styles.pdfIcon}>📄</span>
                        <span className={styles.pdfName}>{pdf.originalFileName}</span>
                      </a>
                      {editSection === 'documents' && (
                        <button className={styles.deleteDocBtnPdf} onClick={() => setDeletedDocIds([...deletedDocIds, pdf.id])}>&times;</button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.empty}>No documents available.</p>
              )}
            </div>
          )}
        </div>
      </section>

    </div>
  );
}
