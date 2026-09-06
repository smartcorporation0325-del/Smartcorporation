"use client";

export default function DeleteButton({
  action,
  confirmMessage = "Are you sure you want to delete this?",
}: {
  action: () => void;
  confirmMessage?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(confirmMessage)) e.preventDefault();
      }}
    >
      <button type="submit" className="btn-danger">
        Delete
      </button>
    </form>
  );
}
