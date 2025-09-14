import mongoose from 'mongoose';

// Export all models
export { Brand, IBrand, Address, ContactInfo, BusinessHour } from './Brand';
export { Client, IClient, ClientPreferences } from './Client';
export { Class, IClass, TimeBlock } from './Class';
export { Session, ISession, SessionAttendee } from './Session';
export { SubscriptionPlan, ISubscriptionPlan, FrequencyLimit } from './SubscriptionPlan';
export { CreditPlan, ICreditPlan } from './CreditPlan';
export { Subscription, ISubscription } from './Subscription';
export { CreditBalance, ICreditBalance, CreditPackage, CreditTransaction } from './CreditBalance';
export { Payment, IPayment, PaymentMetadata, StripeEventData } from './Payment';

// Re-export mongoose types for convenience
export { Document } from 'mongoose';
export type ObjectId = mongoose.Types.ObjectId;