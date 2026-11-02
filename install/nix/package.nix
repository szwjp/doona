{
  lib,
  stdenvNoCC,
  fetchurl,
  nix-update-script,
  withFonts ? true,
}:
let
  version = "0.1.0-rc.5";
  fonts = fetchurl {
    url = "https://github.com/szwjp/doona/releases/download/v${version}/doona-fonts-${version}.tar.gz";
    hash = "sha256-QRJ7hpz9X799BH9jiTywIg10IRdeT+nm/a07ywFyiV8=";
  };
in
stdenvNoCC.mkDerivation (finalAttrs: {
  pname = "doona";
  inherit version;

  src = fetchurl {
    url = "https://github.com/szwjp/doona/releases/download/v${finalAttrs.version}/doona-${finalAttrs.version}.tar.gz";
    hash = "sha256-X1p5Gx2eNoPHZGKxpYS1v9zldev4UqqDJftZaBLgL50=";
  };

  dontUnpack = true;
  installPhase = ''
    runHook preInstall
    mkdir -p $out/share/doona
    tar -xzf $src -C $out/share/doona
  ''
  + lib.optionalString withFonts ''
    tar -xzf ${fonts} -C $out/share/doona
  ''
  + ''
    runHook postInstall
  '';

  passthru.updateScript = nix-update-script { };

  meta = {
    description = "Web UI for the daeuniverse engines";
    homepage = "https://github.com/Zakkaus/doona";
    # lib.licenses has no entry for the GitHub mark's logo terms, which LICENSES/LicenseRef-GitHub-Logos.txt holds.
    license =
      with lib.licenses;
      [ gpl3Only bsd0 asl20 bsd3 isc mit cc-by-30 cc-by-40 cc-by-sa-40 cc0 ] ++ lib.optional withFonts ofl;
    platforms = lib.platforms.linux;
    # Needs a maintainers/maintainer-list.nix entry in its own commit before submission.
    maintainers = with lib.maintainers; [ zakkaus ];
  };
})
