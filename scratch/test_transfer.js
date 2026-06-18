const Stripe = require('stripe');
const stripe = Stripe('sk_test_51TCzYR8iGRmogjncaXxCNpOVDqVZAPdr9FD1osFPfyyOLYjDiYrvxbpz4MOgCYLL4nb0uzwAz6ANaOfpxRTAaUFA00nWSQprmy');

async function testTransfer() {
  try {
    const transfer = await stripe.transfers.create({
      amount: 1000,
      currency: 'aud',
      destination: 'acct_1TirxA8iGRP26vX8'
    });
    console.log("SUCCESS:", transfer.id);
  } catch (e) {
    console.error("ERROR:", e.message);
  }
}

testTransfer();
