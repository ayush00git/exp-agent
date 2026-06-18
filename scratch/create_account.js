const Stripe = require('stripe');
const stripe = Stripe('sk_test_51TCzXF7xB4vKGIWjTRboO0GAetn3i7cCGei0revMGqignupsm6lIvynlEifZA3yBINFJ2jsop6QlPu83bljP0pjl00yv11OQnk');

async function createAccount() {
  try {
    const account = await stripe.accounts.create({
      type: 'custom',
      country: 'AU',
      capabilities: {
        transfers: { requested: true },
      },
    });
    console.log("SUCCESS_ACCOUNT_ID=" + account.id);
  } catch (e) {
    console.error(e);
  }
}

createAccount();
