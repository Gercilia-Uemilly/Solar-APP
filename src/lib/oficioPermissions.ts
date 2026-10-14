export function canEditOficioContent(
  userId: string | null | undefined,
  isAdmin: boolean,
  authorId: string,
) {
  return Boolean(userId && (isAdmin || authorId === userId));
}