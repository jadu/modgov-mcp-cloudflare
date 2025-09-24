import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ModgovClient } from "./modgov-client";
import { CouncilMatcher } from "./council-matcher";

// Define our MCP agent with tools
export class ModGovMCP extends McpAgent {
	server = new McpServer({
		name: "ModGov MCP Server",
		version: "1.0.0",
	});

	private modgovClient: ModgovClient;
	private councilMatcher: CouncilMatcher;

	constructor() {
		super();
		this.modgovClient = new ModgovClient();
		this.councilMatcher = new CouncilMatcher();
	}

	async init() {
		// Register get_councillors_by_ward tool
		this.server.tool(
			"get_councillors_by_ward",
			{
				title: "Get Councillors by Ward",
				description: "Get basic councillor information (name, party, photos) organized by ward from a modgov council API. Note: This returns limited information. For detailed profiles including surgery times and contact details, visit the council website directly.",
				inputSchema: {
					site_url: z.string().describe("The modgov API endpoint URL (e.g., https://democracy.lichfielddc.gov.uk/mgWebService.asmx?WSDL)")
				}
			},
			async ({ site_url }) => {
				const wards = await this.modgovClient.getCouncillorsByWard(site_url);
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(this.formatCouncillorsResponse(site_url, wards), null, 2),
						}
					]
				};
			}
		);

		// Register get_councillors_by_ward_id tool
		this.server.tool(
			"get_councillors_by_ward_id",
			{
				title: "Get Councillors by Ward ID",
				description: "Get basic councillor information (name, party, photos) for a specific ward ID from a modgov council API. Note: This returns limited information. For detailed profiles including surgery times and contact details, visit the council website directly.",
				inputSchema: {
					site_url: z.string().describe("The modgov API endpoint URL"),
					ward_id: z.number().describe("The ward ID to query")
				}
			},
			async ({ site_url, ward_id }) => {
				const wards = await this.modgovClient.getCouncillorsByWardId(site_url, ward_id);
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(this.formatCouncillorsResponse(site_url, wards), null, 2),
						}
					]
				};
			}
		);

		// Register get_councillors_by_postcode tool
		this.server.tool(
			"get_councillors_by_postcode",
			{
				title: "Get Councillors by Postcode",
				description: "Get basic councillor information (name, party, photos) for a specific postcode from a modgov council API. Note: This returns limited information. For detailed profiles including surgery times and contact details, visit the council website directly.",
				inputSchema: {
					site_url: z.string().describe("The modgov API endpoint URL"),
					postcode: z.string().describe("The postcode to query")
				}
			},
			async ({ site_url, postcode }) => {
				const wards = await this.modgovClient.getCouncillorsByPostcode(site_url, postcode);
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(this.formatCouncillorsResponse(site_url, wards), null, 2),
						}
					]
				};
			}
		);

		// Register get_committees tool
		this.server.tool(
			"get_committees",
			{
				title: "Get Committees",
				description: "Get all committees from a modgov council API",
				inputSchema: {
					site_url: z.string().describe("The modgov API endpoint URL")
				}
			},
			async ({ site_url }) => {
				const committees = await this.modgovClient.getCommittees(site_url);
				const response = {
					site_url,
					total_committees: committees.length,
					committees: committees.map(committee => ({
						id: committee.committeeid,
						title: committee.committeetitle,
						description: committee.committeedescription,
						type: committee.committeetype
					}))
				};
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(response, null, 2),
						}
					]
				};
			}
		);

		// Register get_meetings tool
		this.server.tool(
			"get_meetings",
			{
				title: "Get Meetings",
				description: "Get meetings for a specific committee from a modgov council API",
				inputSchema: {
					site_url: z.string().describe("The modgov API endpoint URL"),
					committee_id: z.number().describe("The committee ID to get meetings for"),
					from_date: z.string().optional().describe("Start date in YYYY-MM-DD format (defaults to current year)"),
					to_date: z.string().optional().describe("End date in YYYY-MM-DD format (defaults to current year)")
				}
			},
			async ({ site_url, committee_id, from_date, to_date }) => {
				const meetings = await this.modgovClient.getMeetings(site_url, committee_id, from_date, to_date);
				const response = {
					site_url,
					committee_id,
					total_meetings: meetings.length,
					meetings: meetings.map(meeting => ({
						id: meeting.meetingid,
						title: meeting.meetingtitle,
						date: meeting.meetingdate,
						time: meeting.meetingtime,
						location: meeting.meetinglocation,
						committee_id: meeting.committeeid,
						committee_title: meeting.committeetitle
					}))
				};
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(response, null, 2),
						}
					]
				};
			}
		);

		// Register find_council tool
		this.server.tool(
			"find_council",
			{
				title: "Find Council by Name",
				description: "Find a ModernGov council by name using fuzzy matching. Returns the best matching council with its URL and details.",
				inputSchema: {
					council_name: z.string().describe("The council name to search for (e.g., 'Leeds', 'Lichfield District Council', 'Manchester')")
				}
			},
			async ({ council_name }) => {
				const match = this.councilMatcher.findBestMatch(council_name);
				if (!match) {
					return {
						content: [
							{
								type: "text",
								text: `No council found matching "${council_name}". Try using a different name or search term.`,
							}
						],
						isError: true
					};
				}

				const response = {
					query: council_name,
					match: {
						council: match.council.council,
						url: match.council.url,
						region: match.council.region,
						type: match.council.type,
						confidence: match.confidence,
						score: Math.round(match.score * 100) / 100
					},
					message: match.confidence === 'exact'
						? "Exact match found!"
						: match.confidence === 'high'
						? "High confidence match found."
						: match.confidence === 'medium'
						? "Medium confidence match found."
						: "Low confidence match found. You may want to try a more specific search term."
				};

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(response, null, 2),
						}
					]
				};
			}
		);

		// Register search_councils tool
		this.server.tool(
			"search_councils",
			{
				title: "Search Councils",
				description: "Search for councils using fuzzy matching. Returns all matching councils above a minimum confidence threshold.",
				inputSchema: {
					query: z.string().describe("Search query for council names"),
					min_confidence: z.string().optional().describe("Minimum confidence level: 'exact', 'high', 'medium', 'low' (default: 'medium')")
				}
			},
			async ({ query, min_confidence }) => {
				const confidenceThresholds = {
					'exact': 0.95,
					'high': 0.8,
					'medium': 0.6,
					'low': 0.3
				};

				const minScore = confidenceThresholds[min_confidence as keyof typeof confidenceThresholds] || 0.6;
				const matches = this.councilMatcher.findMatches(query, minScore);

				if (matches.length === 0) {
					return {
						content: [
							{
								type: "text",
								text: `No councils found matching "${query}" with confidence level "${min_confidence || 'medium'}". Try using a different search term or lowering the confidence threshold.`,
							}
						],
						isError: true
					};
				}

				const response = {
					query,
					min_confidence: min_confidence || 'medium',
					total_matches: matches.length,
					matches: matches.map(match => ({
						council: match.council.council,
						url: match.council.url,
						region: match.council.region,
						type: match.council.type,
						confidence: match.confidence,
						score: Math.round(match.score * 100) / 100
					}))
				};

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(response, null, 2),
						}
					]
				};
			}
		);

		// Register get_council_by_region tool
		this.server.tool(
			"get_council_by_region",
			{
				title: "Get Councils by Region",
				description: "Get all councils in a specific region",
				inputSchema: {
					region: z.string().describe("Region name (e.g., 'London', 'West Midlands', 'Scotland')")
				}
			},
			async ({ region }) => {
				const councils = this.councilMatcher.findByRegion(region);

				if (councils.length === 0) {
					return {
						content: [
							{
								type: "text",
								text: `No councils found in region "${region}". Available regions include: West Midlands, London, North West, Wales, North East, South East, South West, East of England, East Midlands, Yorkshire and Humber, Scotland.`,
							}
						],
						isError: true
					};
				}

				const response = {
					region,
					total_councils: councils.length,
					councils: councils.map(council => ({
						council: council.council,
						url: council.url,
						type: council.type
					}))
				};

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(response, null, 2),
						}
					]
				};
			}
		);
	}

	private formatCouncillorsResponse(site_url: string, wards: any[]) {
		return {
			site_url,
			total_wards: wards.length,
			total_councillors: wards.reduce((sum, ward) =>
				sum + parseInt(ward.councillors.councillorcount || '0'), 0
			),
			wards: wards.map(ward => ({
				ward_name: ward.wardtitle,
				councillor_count: ward.councillors.councillorcount,
				councillors: ward.councillors.councillor.map((c: any) => ({
					id: c.councillorid,
					name: c.fullusername,
					party: c.politicalpartytitle || 'Unknown',
					group: c.politicalgrouptitle || 'Unknown',
					district: c.districttitle || 'Unknown',
					representing: c.representing || 'Unknown',
					photos: {
						small: c.photosmallurl,
						large: c.photobigurl
					},
					additional_info: c.additionalcontactinfo,
					key_posts: c.keyposts
				}))
			})),
			additional_information_note: "This provides basic councillor information only. For detailed profiles including surgery times, contact details, and email addresses, use the 'get_councillor_details' tool with the councillor's ID."
		};
	}
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			return ModGovMCP.serveSSE("/sse").fetch(request, env, ctx);
		}

		if (url.pathname === "/mcp") {
			return ModGovMCP.serve("/mcp").fetch(request, env, ctx);
		}

		return new Response("Not found", { status: 404 });
	},
};
