import OrderWizard from "@/components/workspaces/order-wizard";

export default async function EditOrderPage({
  params,
}: PageProps<"/orders/[orderId]/edit">) {
  const { orderId } = await params;
  return <OrderWizard orderId={orderId} />;
}
