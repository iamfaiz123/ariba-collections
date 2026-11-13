-- Coupons the storefront advertises. Edit or switch them off later in /admin (or the coupons API).
INSERT INTO cart.coupons (code, description, kind, value, min_subtotal_paise) VALUES
  ('ARIBAS10', '10% off on your order', 'percent', 10, 0),
  ('FESTIVE500', '₹500 off on orders above ₹4,999', 'flat', 50000, 499900),
  ('WELCOME15', '15% off orders above ₹2,999', 'percent', 15, 299900)
ON CONFLICT (code) DO NOTHING;
