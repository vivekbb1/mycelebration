import { it } from 'node:test';
import { strictEqual } from 'node:assert';
import { guestSubstitutionComparison, substitutionRecipient, withPreorderAlternative } from './outfit-substitution';
import type { OrderItem } from './shop-order';
it('pre-order substitutes carry into orders without changing original selection or size', () => {
  const item = { reservationId: 'person', title: 'Original outfit', size: 'M', originalPrice: 30000, price: 30000, discount: 0 } as OrderItem;
  const result = withPreorderAlternative(item, { alternative: { title: 'Vendor alternative', sku: 'ALT1' }, ordered_size: 'L', revised_price: 35000 });
  strictEqual(result.title, 'Original outfit'); strictEqual(result.size, 'M'); strictEqual(result.originalPrice, 30000);
  strictEqual(result.alternative?.title, 'Vendor alternative'); strictEqual(result.orderedSize, 'L'); strictEqual(result.price, 35000);
  strictEqual(item.alternative, undefined);
});
it('guest comparison includes original and replacement sizes but excludes prices and shop links', () => {
  const original = { title: 'Original outfit', size: 'M', wearer: 'Guest', event: 'Wedding', price: 30000, shop: 'https://shop.example' };
  const replacement = { title: 'Vendor alternative', size: 'L', price: 35000, shop: 'https://shop.example' };
  const data = guestSubstitutionComparison(original, replacement);
  strictEqual(data.originalTitle, 'Original outfit'); strictEqual(data.originalSize, 'M');
  strictEqual(data.replacementTitle, 'Vendor alternative'); strictEqual(data.replacementSize, 'L');
  strictEqual(JSON.stringify(data).includes('30000'), false); strictEqual(JSON.stringify(data).includes('35000'), false); strictEqual(JSON.stringify(data).includes('https://shop.example'), false);
});
it('proxy change emails go to the wearer and ambiguous legacy wearers are blocked', () => {
  const codes = [
    { id: 'spouse', guest_name: 'Spouse', household: 'Family', claimed_by: 'account', email: 'spouse@example.test' },
    { id: 'wearer', guest_name: 'Guest', household: 'Family', claimed_by: null, email: 'guest@example.test' },
  ];
  strictEqual(substitutionRecipient({ member_code_id: 'wearer', guest_id: 'account', guest_name: 'Old name' }, codes), 'guest@example.test');
  strictEqual(substitutionRecipient({ member_code_id: null, guest_id: 'account', guest_name: 'Unknown' }, codes), null);
  strictEqual(substitutionRecipient({ member_code_id: null, guest_id: 'account', guest_name: 'Guest' }, [...codes, { ...codes[1], id: 'duplicate', guest_name: 'Guest', household: 'Family', claimed_by: null, email: 'other@example.test' }]), null);
});