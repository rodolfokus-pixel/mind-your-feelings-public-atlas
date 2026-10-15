# Mind Your Feelings Public Data Atlas

The public, portfolio-aligned edition of the Mind Your Feelings Data Atlas. It presents anonymous collective patterns through interactive visualizations without exposing the internal research archive.

## Public-data boundary

Only fields required by the visualizations are included in the deployed JSON. The public edition removes original response identifiers, precise response times, kiosk identifiers, upload metadata, local paths, filenames, and Google Drive links. Body-map filenames are replaced with neutral public identifiers. The interface has no data upload or download controls.

Run `scripts/sanitize_public_data.mjs <source-project>` whenever the private archive is refreshed. The script pseudonymizes identifiers, copies body drawings under neutral filenames, and deletes unused point-level source data from the public tree.

## Development

```sh
npm run dev
npm run build
```

The production output is written to `dist/`. The application is designed to be deployed as a static site at `atlas.rodolfokusulas.com`.

## Visualization modules

- Response Clusters
- Emotion Timeline
- Neural Emotion Map
- Body Atlas
