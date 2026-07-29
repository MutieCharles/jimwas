export interface PaymentRequest {
  phoneNumber: string; // e.g. "254700123456"
  amount: string; // amount as string to preserve formatting, e.g. "100"
  invoiceNumber: string; // e.g. "KCBTILLNO-JIMWAS001"
  sharedShortCode: boolean;
  orgShortCode?: string;
  orgPassKey?: string;
  callbackUrl: string;
  transactionDescription?: string;
  metadata?: Record<string, any>;
}
