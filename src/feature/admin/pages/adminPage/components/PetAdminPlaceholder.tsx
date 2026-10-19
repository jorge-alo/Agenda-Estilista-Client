interface Props {
  id: string;
  title: string;
  description: string;
}

export const PetAdminPlaceholder = ({ id, title, description }: Props) => {
  const titleId = `pet-admin-placeholder-${id}-title`;

  return (
    <section className="pet-admin-placeholder" aria-labelledby={titleId}>
      <h2 id={titleId} className="pet-admin-placeholder-title">{title}</h2>
      <p className="pet-admin-placeholder-text">{description}</p>
    </section>
  );
};
