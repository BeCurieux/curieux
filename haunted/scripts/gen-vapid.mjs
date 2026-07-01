// Generate a VAPID keypair for web push. Run: npm run keys:vapid
import webpush from 'web-push';

const keys = webpush.generateVAPIDKeys();
console.log('VAPID_PUBLIC=' + keys.publicKey);
console.log('VAPID_PRIVATE=' + keys.privateKey);
console.log('NEXT_PUBLIC_VAPID_PUBLIC=' + keys.publicKey);
console.log('# Also set VAPID_SUBJECT=mailto:you@example.com');
