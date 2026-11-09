import type { Coupon } from '@/types';

export const COUPONS: Coupon[] = [
  { code: 'ARIBAS10', description: '10% off on your order', type: 'percent', value: 10, minSubtotal: 0 },
  { code: 'FESTIVE500', description: '₹500 off on orders above ₹4,999', type: 'flat', value: 500, minSubtotal: 4999 },
  { code: 'WELCOME15', description: '15% off orders above ₹2,999', type: 'percent', value: 15, minSubtotal: 2999 },
];

export const SHIPPING = {
  freeAbove: 1999,
  standardFee: 99,
  expressFee: 199,
  codFee: 49,
};

export const FAQS = [
  { q: 'How do I choose the right size?', a: 'Every product page has a size chart. Measure your bust, waist and hip and pick the size that fits your largest measurement. Our kurtas include 1.5–2" of seam allowance for alterations.' },
  { q: 'How long does delivery take?', a: 'Standard delivery takes 4–7 business days across India. Express delivery takes 1–3 business days in metro cities.' },
  { q: 'Do you offer Cash on Delivery?', a: 'Yes — COD is available on orders up to ₹15,000 with a small handling fee of ₹49.' },
  { q: 'What is your return policy?', a: 'Stitched suits can be returned or exchanged within 7 days of delivery if unworn with tags intact. Unstitched fabric is non-returnable once cut.' },
  { q: 'Are the colours accurate?', a: 'We shoot every product in natural light. Slight variations may occur due to screen settings and the handcrafted nature of dyes.' },
  { q: 'Can I get custom stitching?', a: 'Custom stitching for unstitched suits is coming soon. Meanwhile, write to us and our team will guide you.' },
];

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh',
  'Jammu & Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
  'Uttarakhand', 'West Bengal',
];

export const SIZE_CHART = [
  { size: 'XS', bust: 32, waist: 26, hip: 35, length: 44 },
  { size: 'S', bust: 34, waist: 28, hip: 37, length: 44 },
  { size: 'M', bust: 36, waist: 30, hip: 39, length: 45 },
  { size: 'L', bust: 38, waist: 32, hip: 41, length: 45 },
  { size: 'XL', bust: 40, waist: 34, hip: 43, length: 46 },
  { size: 'XXL', bust: 42, waist: 36, hip: 45, length: 46 },
];
