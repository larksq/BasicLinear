/** The same brand asset is used for application chrome and browser favicons. */
export function BrandMark({className}: {className?: string}) {
  return <img className={className} src="/favicon.svg" alt="" aria-hidden="true" />;
}
