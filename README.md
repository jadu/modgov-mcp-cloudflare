# ModGov MCP Server for Cloudflare Workers

This is a Cloudflare Workers implementation of the ModGov MCP server, which provides tools for interacting with ModernGov council APIs. It allows you to query council information, councillors, committees, meetings, and more from any council using the ModernGov system.

## Features

- **Council Search**: Find councils by name, region, or type using fuzzy matching
- **Councillor Information**: Get councillor details by ward, ward ID, or postcode
- **Committee Management**: List committees and their meetings
- **Meeting Information**: Get meeting details, including dates, times, and locations
- **Region-based Lookup**: Find all councils in a specific region

## Available Tools

- `find_council`: Find a council by name using fuzzy matching
- `search_councils`: Search for councils with configurable confidence thresholds
- `get_council_by_region`: Get all councils in a specific region
- `get_councillors_by_ward`: Get councillors organized by ward
- `get_councillors_by_ward_id`: Get councillors for a specific ward ID
- `get_councillors_by_postcode`: Get councillors for a specific postcode
- `get_committees`: Get all committees for a council
- `get_meetings`: Get meetings for a specific committee

## Getting Started

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/modgov-mcp-cloudflare.git
   cd modgov-mcp-cloudflare
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run locally:
   ```bash
   npm run dev
   ```

4. Deploy to Cloudflare Workers:
   ```bash
   npm run deploy
   ```

## Configuration

The server will be deployed to a URL like: `modgov-mcp.<your-account>.workers.dev`

You can connect to it using any MCP client:

### Cloudflare AI Playground

1. Go to https://playground.ai.cloudflare.com/
2. Enter your deployed MCP server URL (`modgov-mcp.<your-account>.workers.dev/sse`)
3. You can now use the ModGov tools directly from the playground!

### Claude Desktop

1. Follow [Anthropic's Quickstart](https://modelcontextprotocol.io/quickstart/user)
2. In Claude Desktop, go to Settings > Developer > Edit Config
3. Update with this configuration:

```json
{
  "mcpServers": {
    "modgov": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://localhost:8787/sse"  // or modgov-mcp.your-account.workers.dev/sse
      ]
    }
  }
}
```

## Example Usage

Here are some example queries you can try:

1. Find a council:
   ```
   Find information about Lichfield District Council
   ```

2. Get councillors by postcode:
   ```
   Who are the councillors for postcode WS13 6HX?
   ```

3. Get committee meetings:
   ```
   What meetings are scheduled for the Planning Committee at Leeds City Council?
   ```

4. Search by region:
   ```
   Show me all councils in the West Midlands
   ```

## Development

To add new tools or modify existing ones, edit the `src/index.ts` file. The server uses:

- `ModgovClient`: Handles API calls to ModernGov endpoints
- `CouncilMatcher`: Provides fuzzy matching for council searches
- `councils.json`: Contains the database of ModernGov councils

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details
