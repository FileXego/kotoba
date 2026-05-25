interface Props {
  name: string;
  src?: string | null;
}

export function Avatar({ name, src }: Props) {
  if (src) return <img className="avatar avatar-img" src={src} alt="" loading="lazy" />;
  return <div className="avatar">{name.charAt(0)}</div>;
}
