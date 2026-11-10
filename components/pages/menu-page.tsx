"use client";
import MenuWorkspace from "@/components/workspaces/menu-workspace";
import { usePos } from "@/components/pos-provider";
export default function MenuPageContent() {
  const {
    data,
    menuItems,
    openMenuEditor,
    openCategoryEditor,
    deleteCategory,
    toggleMenuAvailability,
    restockMenuItem,
  } = usePos();
  return (
    <MenuWorkspace
      data={data}
      menuItems={menuItems}
      openMenuEditor={openMenuEditor}
      openCategoryEditor={openCategoryEditor}
      deleteCategory={deleteCategory}
      toggleMenuAvailability={toggleMenuAvailability}
      restockMenuItem={restockMenuItem}
    />
  );
}
