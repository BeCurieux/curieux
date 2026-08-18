type ActualVisualProps = {
  kind: "mechanic" | "catalogue" | "post" | "creators";
  priority?: boolean;
};

const VISUALS = {
  mechanic: {
    src: "/visuals/mechanic.svg",
    alt: "POPUUP campaign artwork showing Make a shop in a sentence and wedding guest shop concepts",
  },
  catalogue: {
    src: "/visuals/catalogue.svg",
    alt: "POPUUP artwork showing one catalogue becoming multiple contextual shops",
  },
  post: {
    src: "/visuals/post.svg",
    alt: "POPUUP artwork showing social posts turning into Ibiza and lavender contextual shops",
  },
  creators: {
    src: "/visuals/creators.svg",
    alt: "POPUUP artwork showing creator-specific storefront concepts",
  },
} as const;

export function ActualVisual({ kind, priority = false }: ActualVisualProps) {
  const item = VISUALS[kind];

  return (
    <figure className={`actual-visual actual-visual-${kind}`}>
      <img src={item.src} alt={item.alt} loading={priority ? "eager" : "lazy"} />
      <figcaption>POPUUP creative concept · current early-access capabilities are described below.</figcaption>
    </figure>
  );
}
