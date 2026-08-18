import "./artwork-slices.css";

type CropProps = {
  src: string;
  alt: string;
  columns?: number;
  rows?: number;
  column?: number;
  row?: number;
  aspect: string;
  className?: string;
};

function Crop({
  src,
  alt,
  columns = 1,
  rows = 1,
  column = 0,
  row = 0,
  aspect,
  className = "",
}: CropProps) {
  const style = {
    "--cols": columns,
    "--rows": rows,
    "--col": column,
    "--row": row,
    "--slice-aspect": aspect,
  } as React.CSSProperties;

  return (
    <figure className={`art-slice ${className}`} style={style}>
      <div className="art-slice-window">
        <img src={src} alt={alt} loading="lazy" />
      </div>
      <figcaption>POPUUP concept</figcaption>
    </figure>
  );
}

export function MechanicArtwork() {
  return (
    <div className="artwork-group artwork-group-mechanic" aria-label="POPUUP prompt to shop concepts">
      <Crop
        src="/visuals/mechanic.svg"
        alt="Make a shop in a sentence concept showing a prompt becoming a wedding guest shop"
        columns={3}
        column={0}
        aspect="0.57"
      />
      <Crop
        src="/visuals/mechanic.svg"
        alt="Wedding guest POPUUP concept with merchandising constraints and mobile shop"
        columns={3}
        column={1}
        aspect="0.57"
      />
      <Crop
        src="/visuals/mechanic.svg"
        alt="POPUUP prompt card and generated mobile shop concept"
        columns={3}
        column={2}
        aspect="0.57"
      />
    </div>
  );
}

export function CatalogueArtwork() {
  return (
    <div className="artwork-group artwork-group-catalogue" aria-label="One catalogue, many shops concepts">
      <Crop
        src="/visuals/catalogue.svg"
        alt="One catalogue, infinite shops POPUUP concept"
        rows={2}
        row={0}
        aspect="3.55"
        className="art-slice-wide"
      />
      <Crop
        src="/visuals/catalogue.svg"
        alt="One catalogue becoming multiple contextual POPUUP shops"
        rows={2}
        row={1}
        aspect="3.55"
        className="art-slice-wide"
      />
    </div>
  );
}

export function PostArtwork() {
  return (
    <div className="artwork-group artwork-group-post" aria-label="Post to shop POPUUP concepts">
      <Crop
        src="/visuals/post.svg"
        alt="A social post becoming its own POPUUP shop"
        columns={3}
        column={0}
        aspect="0.79"
      />
      <Crop
        src="/visuals/post.svg"
        alt="Every click deserves its own shop POPUUP concept"
        columns={3}
        column={1}
        aspect="0.79"
      />
      <Crop
        src="/visuals/post.svg"
        alt="Ibiza campaign turning into a focused POPUUP edit"
        columns={3}
        column={2}
        aspect="0.79"
      />
    </div>
  );
}

export function CreatorArtwork() {
  return (
    <div className="artwork-group artwork-group-creators" aria-label="Creator shop POPUUP concepts">
      <Crop
        src="/visuals/creators.svg"
        alt="Give every creator their own shop POPUUP concept"
        columns={2}
        column={0}
        aspect="0.99"
      />
      <Crop
        src="/visuals/creators.svg"
        alt="Creator picks flowing into a dedicated POPUUP shop"
        columns={2}
        column={1}
        aspect="0.99"
      />
    </div>
  );
}
