import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { cards, categories } from '../api';

function CardForm({ token }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [formData, setFormData] = useState({
    title: '',
    cardholder_name: '',
    card_number: '',
    expiry_month: '',
    expiry_year: '',
    cvv: '',
    brand: '',
    category_id: '',
    notes: ''
  });
  const [categoryList, setCategoryList] = useState([]);
  const [showCvv, setShowCvv] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadCategories();
    if (isEdit) {
      loadCard();
    }
  }, [id]);

  const loadCategories = async () => {
    try {
      const response = await categories.getAll();
      setCategoryList(response.data);
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  };

  const loadCard = async () => {
    try {
      const response = await cards.getAll(null, null, null, true);
      const card = response.data.find(c => c.id === parseInt(id));
      if (card) {
        setFormData({
          title: card.title,
          cardholder_name: card.cardholder_name || '',
          card_number: card.card_number || '',
          expiry_month: card.expiry_month || '',
          expiry_year: card.expiry_year || '',
          cvv: card.cvv || '',
          brand: card.brand || '',
          category_id: card.category_id || '',
          notes: card.notes || ''
        });
      }
    } catch (err) {
      console.error('Error loading card:', err);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const detectBrand = (number) => {
    if (!number) return '';
    const cleaned = number.replace(/\s/g, '');
    if (/^4/.test(cleaned)) return 'Visa';
    if (/^5[1-5]/.test(cleaned)) return 'Mastercard';
    if (/^3[47]/.test(cleaned)) return 'American Express';
    if (/^6(?:011|5)/.test(cleaned)) return 'Discover';
    return '';
  };

  const handleCardNumberChange = (e) => {
    const value = e.target.value.replace(/\D/g, '');
    const formatted = value.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
    const brand = detectBrand(value);
    setFormData({ 
      ...formData, 
      card_number: formatted,
      brand: brand || formData.brand
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.title || !formData.card_number) {
      setError('Title and card number are required');
      return;
    }

    try {
      const data = {
        title: formData.title,
        cardholder_name: formData.cardholder_name || null,
        card_number: formData.card_number.replace(/\s/g, ''),
        expiry_month: formData.expiry_month || null,
        expiry_year: formData.expiry_year || null,
        cvv: formData.cvv || null,
        brand: formData.brand || null,
        category_id: formData.category_id || null,
        notes: formData.notes || null,
        folder_id: formData.folder_id || null
      };

      if (isEdit) {
        await cards.update(id, data);
      } else {
        await cards.create(data);
      }
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Error saving card');
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory.trim()) return;
    try {
      await categories.create(newCategory);
      setNewCategory('');
      loadCategories();
    } catch (err) {
      alert(err.response?.data?.error || 'Error creating category');
    }
  };

  return (
    <div className="container">
      <div className="form-container">
        <h1>{isEdit ? 'Edit Card' : 'Add Card'}</h1>
        
        {error && <p className="error">{error}</p>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Title *</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              placeholder="e.g., Personal Visa, Business Card"
            />
          </div>

          <div className="form-group">
            <label>Cardholder Name</label>
            <input
              type="text"
              name="cardholder_name"
              value={formData.cardholder_name}
              onChange={handleChange}
              placeholder="JOHN DOE"
            />
          </div>

          <div className="form-group">
            <label>Card Number *</label>
            <input
              type="text"
              name="card_number"
              value={formData.card_number}
              onChange={handleCardNumberChange}
              required
              placeholder="1234 5678 9012 3456"
              maxLength="19"
            />
            {formData.brand && <span style={{ marginLeft: '10px', color: '#666' }}>{formData.brand}</span>}
          </div>

          <div className="form-group">
            <label>Expiry Date</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                name="expiry_month"
                value={formData.expiry_month}
                onChange={handleChange}
                placeholder="MM"
                maxLength="2"
                style={{ width: '60px' }}
              />
              <span style={{ alignSelf: 'center' }}>/</span>
              <input
                type="text"
                name="expiry_year"
                value={formData.expiry_year}
                onChange={handleChange}
                placeholder="YY"
                maxLength="2"
                style={{ width: '60px' }}
              />
            </div>
          </div>

          <div className="form-group">
            <label>CVV</label>
            <div className="password-display">
              <input
                type={showCvv ? 'text' : 'password'}
                name="cvv"
                value={formData.cvv}
                onChange={handleChange}
                maxLength="4"
                style={{ width: '80px' }}
              />
              <button type="button" onClick={() => setShowCvv(!showCvv)} className="secondary">
                {showCvv ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Category</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <select
                name="category_id"
                value={formData.category_id}
                onChange={handleChange}
                style={{ flex: 1 }}
              >
                <option value="">No Category</option>
                {categoryList.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
              {formData.category_id && (
                <button type="button" onClick={() => { if (window.confirm('Delete this category?')) { categories.delete(formData.category_id).then(() => { setFormData({ ...formData, category_id: '' }); loadCategories(); }).catch(err => alert(err.response?.data?.error || 'Error deleting category')); } }} className="danger" style={{ padding: '8px 12px' }}>X</button>
              )}
              <input
                type="text"
                placeholder="New category"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                style={{ width: '150px' }}
              />
              <button type="button" onClick={handleAddCategory} className="secondary">Add</button>
            </div>
          </div>

          <div className="form-group">
            <label>Notes</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Additional notes..."
            />
          </div>

          <div className="form-actions">
            <button type="submit" className="success">{isEdit ? 'Update' : 'Save'}</button>
            <button type="button" onClick={() => navigate('/')} className="secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CardForm;
