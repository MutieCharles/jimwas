import { PaymentRepository } from '../repositories/PaymentRepository';
import { PaymentRequest } from '../dto/PaymentRequest';
import { PaymentProvider } from '../providers/PaymentProvider';

export class PaymentService {
  private providers: Record<string, PaymentProvider>;
  private repository: PaymentRepository;
  private defaultProviderKey = 'kcb_buni';

  constructor(repository: PaymentRepository, providers: Record<string, PaymentProvider>) {
    this.repository = repository;
    this.providers = providers;
  }

  private getProvider(key?: string): PaymentProvider {
    const resolved = key || this.defaultProviderKey;
    const provider = this.providers[resolved];
    if (!provider) throw new Error(`Payment provider not registered: ${resolved}`);
    return provider;
  }

  public async initiatePayment(request: PaymentRequest, providerKey?: string) {
    const provider = this.getProvider(providerKey);
    const response = await provider.initiatePayment(request);

    await this.repository.createFromInitiation({
      provider: response.provider,
      merchantRequestId: response.merchantRequestId,
      checkoutRequestId: response.checkoutRequestId,
      providerTransactionId: response.providerTransactionId,
      phoneNumber: request.phoneNumber,
      amount: Number(request.amount),
      invoiceNumber: request.invoiceNumber,
      status: response.status,
      raw: response.raw,
    });

    return response;
  }
}
