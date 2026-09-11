import { Providers } from '../providers';

export default function MerchantLayout({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>;
}
