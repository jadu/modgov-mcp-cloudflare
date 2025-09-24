import axios from 'axios';
import { parseStringPromise } from 'xml2js';

export interface Councillor {
  councillorid: string;
  fullusername: string;
  photosmallurl?: string;
  photobigurl?: string;
  politicalpartytitle?: string;
  politicalgrouptitle?: string;
  districttitle?: string;
  representing?: string;
  keyposts?: string;
  additionalcontactinfo?: string;
}

export interface Ward {
  wardtitle: string;
  councillors: {
    councillorcount: string;
    councillor: Councillor[];
  };
}

export interface Committee {
  committeeid: string;
  committeetitle: string;
  committeedescription?: string;
  committeetype?: string;
}

export interface Meeting {
  meetingid: string;
  meetingtitle: string;
  meetingdate: string;
  meetingtime?: string;
  meetinglocation?: string;
  committeeid?: string;
  committeetitle?: string;
}

export interface CalendarEvent {
  eventid: string;
  eventtitle: string;
  eventdate: string;
  eventdescription?: string;
  eventlocation?: string;
}

export interface ParishCouncil {
  parishcouncilid: string;
  parishcounciltitle: string;
  parishcouncilwebsite?: string;
  parishcouncilcontact?: string;
}

export interface ElectionResult {
  electionid: string;
  electiontitle: string;
  electiondate: string;
  results?: any[];
}

export interface WebCastMeeting {
  meetingid: string;
  meetingtitle: string;
  webcasturl: string;
  meetingdate: string;
}

export interface MpOrMepInfo {
  mpid: string;
  mpname: string;
  constituency?: string;
  party?: string;
  wards?: any[];
}

export class ModgovClient {
  private readonly rateLimiter: Map<string, number> = new Map();
  private readonly rateLimitMs = 1000; // 1 second between requests per domain

  constructor() {}

  /**
   * Validate required parameters for API calls
   */
  private validateParameters(params: Record<string, any>, required: string[]): void {
    for (const param of required) {
      if (params[param] === undefined || params[param] === null) {
        throw new Error(`Missing required parameter: ${param}`);
      }
    }
  }

  /**
   * Validate URL format
   */
  private validateUrl(url: string): void {
    try {
      new URL(url);
    } catch {
      throw new Error(`Invalid URL format: ${url}`);
    }
  }

  /**
   * Enhanced error handling for API responses
   */
  private async handleApiResponse<T>(response: any, parser: (data: string) => Promise<T>): Promise<T> {
    try {
      // Check if response is successful
      if (response.status && response.status !== 200) {
        throw new Error(`API request failed with status code ${response.status}`);
      }

      // Check if we have data
      if (!response.data) {
        throw new Error('No data received from API');
      }

      // Try to parse the response
      return await parser(response.data);
    } catch (error) {
      // Re-throw with more context
      if (error instanceof Error) {
        throw new Error(`API parsing failed: ${error.message}`);
      }
      throw new Error('Unknown API parsing error');
    }
  }

  /**
   * Get all councillors by ward
   */
  async getCouncillorsByWard(siteUrl: string): Promise<Ward[]> {
    this.validateUrl(siteUrl);
    await this.checkRateLimit(siteUrl);

    const endpoint = this.getEndpointUrl(siteUrl, 'GetCouncillorsByWard');
    const response = await axios.get(endpoint);

    return await this.handleApiResponse(response, this.parseCouncillorsResponse.bind(this));
  }

  /**
   * Get councillors by ward ID
   */
  async getCouncillorsByWardId(siteUrl: string, wardId: number): Promise<Ward[]> {
    this.validateUrl(siteUrl);
    this.validateParameters({ wardId }, ['wardId']);
    await this.checkRateLimit(siteUrl);

    const endpoint = this.getEndpointUrl(siteUrl, 'GetCouncillorsByWardId');
    const response = await axios.get(endpoint, {
      params: { lWardId: wardId }
    });

    return await this.handleApiResponse(response, this.parseCouncillorsResponse.bind(this));
  }

  /**
   * Get councillors by postcode
   */
  async getCouncillorsByPostcode(siteUrl: string, postcode: string): Promise<Ward[]> {
    this.validateUrl(siteUrl);
    this.validateParameters({ postcode }, ['postcode']);
    await this.checkRateLimit(siteUrl);

    const endpoint = this.getEndpointUrl(siteUrl, 'GetCouncillorsByPostcode');
    const response = await axios.get(endpoint, {
      params: { sPostcode: postcode }
    });

    return await this.handleApiResponse(response, this.parseCouncillorsResponse.bind(this));
  }

  /**
   * Get all committees
   */
  async getCommittees(siteUrl: string): Promise<Committee[]> {
    this.validateUrl(siteUrl);
    await this.checkRateLimit(siteUrl);

    const endpoint = this.getEndpointUrl(siteUrl, 'GetCommittees');
    const response = await axios.get(endpoint);

    return await this.handleApiResponse(response, this.parseCommitteesResponse.bind(this));
  }

  /**
   * Get meetings for a specific committee
   */
  async getMeetings(siteUrl: string, committeeId: number, fromDate?: string, toDate?: string): Promise<Meeting[]> {
    this.validateUrl(siteUrl);
    this.validateParameters({ committeeId }, ['committeeId']);
    await this.checkRateLimit(siteUrl);

    const endpoint = this.getEndpointUrl(siteUrl, 'GetMeetings');
    const params: any = {
      lCommitteeId: committeeId
    };

    // SERVER BUG WORKAROUND: Server requires both sFromDate and sToDate even though WSDL shows them as optional
    // Provide default date range if not specified
    if (fromDate && toDate) {
      params.sFromDate = fromDate;
      params.sToDate = toDate;
    } else {
      // Default to current year if no dates provided (server bug workaround)
      const currentYear = new Date().getFullYear();
      params.sFromDate = `${currentYear}-01-01`;
      params.sToDate = `${currentYear}-12-31`;
    }

    const response = await axios.get(endpoint, { params });

    return await this.handleApiResponse(response, this.parseMeetingsResponse.bind(this));
  }

  /**
   * Get meeting by ID
   */
  async getMeeting(siteUrl: string, meetingId: number): Promise<Meeting | null> {
    this.validateUrl(siteUrl);
    this.validateParameters({ meetingId }, ['meetingId']);
    await this.checkRateLimit(siteUrl);

    const endpoint = this.getEndpointUrl(siteUrl, 'GetMeeting');
    const response = await axios.get(endpoint, {
      params: { lMeetingId: meetingId }
    });

    const meetings = await this.handleApiResponse(response, this.parseMeetingsResponse.bind(this));
    return meetings.length > 0 ? meetings[0] : null;
  }

  /**
   * Get all meetings by date
   */
  async getAllMeetingsByDate(siteUrl: string, date: string, committeeId?: number, fromDate?: string, toDate?: string, ascendingOrder?: boolean): Promise<Meeting[]> {
    this.validateUrl(siteUrl);
    await this.checkRateLimit(siteUrl);

    const endpoint = this.getEndpointUrl(siteUrl, 'GetAllMeetingsByDate');
    const params: any = {
      bIsAscendingDateOrder: ascendingOrder !== undefined ? ascendingOrder : true // Required boolean parameter
    };

    // According to WSDL, lCommitteeId is required, but we'll make it optional and default to a common committee
    if (committeeId !== undefined) {
      params.lCommitteeId = committeeId;
    } else {
      // Default to Cabinet committee if no committee specified
      params.lCommitteeId = 138;
    }

    // Set from/to dates - use provided dates if available, otherwise use the single date parameter
    if (fromDate && toDate) {
      params.sFromDate = fromDate;
      params.sToDate = toDate;
    } else if (date) {
      params.sFromDate = date;
      params.sToDate = date; // Same date for single day
    } else {
      // Default to current year if no dates provided
      const currentYear = new Date().getFullYear();
      params.sFromDate = `${currentYear}-01-01`;
      params.sToDate = `${currentYear}-12-31`;
    }

    const response = await axios.get(endpoint, { params });

    return await this.handleApiResponse(response, this.parseMeetingsResponse.bind(this));
  }

  /**
   * Get calendar events
   */
  async getCalendarEvents(siteUrl: string, globalCalendar: boolean = true, userId: number = 0, dateStart?: string, dateEnd?: string): Promise<CalendarEvent[]> {
    this.validateUrl(siteUrl);
    await this.checkRateLimit(siteUrl);

    const endpoint = this.getEndpointUrl(siteUrl, 'GetCalendarEvents');
    const params: any = {
      bGlobalCalendar: globalCalendar, // SERVER BUG: Actually required despite WSDL showing optional
      lUserId: userId // SERVER BUG: Actually required despite WSDL showing optional
    };

    // SERVER BUG WORKAROUND: Server requires date parameters despite WSDL showing optional
    if (dateStart && dateEnd) {
      params.sDateStart = dateStart;
      params.sDateEnd = dateEnd;
    } else {
      // Default to current year if no dates provided
      const currentYear = new Date().getFullYear();
      params.sDateStart = `${currentYear}-01-01`;
      params.sDateEnd = `${currentYear}-12-31`;
    }

    const response = await axios.get(endpoint, { params });

    return await this.handleApiResponse(response, this.parseCalendarEventsResponse.bind(this));
  }

  /**
   * Get parish councils
   */
  async getParishCouncils(siteUrl: string): Promise<ParishCouncil[]> {
    this.validateUrl(siteUrl);
    await this.checkRateLimit(siteUrl);

    const endpoint = this.getEndpointUrl(siteUrl, 'GetParishCouncils');
    const response = await axios.get(endpoint);

    return await this.handleApiResponse(response, this.parseParishCouncilsResponse.bind(this));
  }

  /**
   * Get election results
   */
  async getElectionResults(siteUrl: string, electionId: number): Promise<ElectionResult[]> {
    this.validateUrl(siteUrl);
    this.validateParameters({ electionId }, ['electionId']);
    await this.checkRateLimit(siteUrl);

    const endpoint = this.getEndpointUrl(siteUrl, 'GetElectionResults');
    const params: any = {
      lElectionId: electionId // Required integer parameter
    };

    const response = await axios.get(endpoint, { params });

    return await this.handleApiResponse(response, this.parseElectionResultsResponse.bind(this));
  }

  /**
   * Get webcast meetings
   */
  async getWebCastMeetings(siteUrl: string, committeeId: number, fromDate?: string, toDate?: string): Promise<WebCastMeeting[]> {
    this.validateUrl(siteUrl);
    this.validateParameters({ committeeId }, ['committeeId']); // SERVER BUG: Actually required despite WSDL showing optional
    await this.checkRateLimit(siteUrl);

    const endpoint = this.getEndpointUrl(siteUrl, 'GetWebCastMeetings');
    const params: any = {
      lCommitteeId: committeeId // SERVER BUG: Actually required despite WSDL showing optional
    };

    // SERVER BUG WORKAROUND: Server requires date parameters despite WSDL showing optional
    if (fromDate && toDate) {
      params.sFromDate = fromDate;
      params.sToDate = toDate;
    } else {
      // Default to current year if no dates provided
      const currentYear = new Date().getFullYear();
      params.sFromDate = `${currentYear}-01-01`;
      params.sToDate = `${currentYear}-12-31`;
    }

    const response = await axios.get(endpoint, { params });

    return await this.handleApiResponse(response, this.parseWebCastMeetingsResponse.bind(this));
  }

  /**
   * Get MP/MEP and wards information
   */
  async getMpOrMepsAndWards(siteUrl: string, isMPs: boolean = true): Promise<MpOrMepInfo[]> {
    this.validateUrl(siteUrl);
    await this.checkRateLimit(siteUrl);

    const endpoint = this.getEndpointUrl(siteUrl, 'GetMpOrMepsAndWards');
    const params: any = {
      bIsMPs: isMPs // Required boolean parameter
    };

    const response = await axios.get(endpoint, { params });

    return await this.handleApiResponse(response, this.parseMpOrMepsAndWardsResponse.bind(this));
  }

  /**
   * Get MP/MEP and wards by postcode
   */
  async getMpOrMepAndWardsByPostcode(siteUrl: string, postcode: string, isMPs: boolean = true): Promise<MpOrMepInfo[]> {
    this.validateUrl(siteUrl);
    this.validateParameters({ postcode }, ['postcode']);
    await this.checkRateLimit(siteUrl);

    const endpoint = this.getEndpointUrl(siteUrl, 'GetMpOrMepAndWardsByPostcode');
    const params: any = {
      sPostcode: postcode,
      bIsMPs: isMPs // Required boolean parameter
    };

    const response = await axios.get(endpoint, { params });

    return await this.handleApiResponse(response, this.parseMpOrMepsAndWardsResponse.bind(this));
  }

  private getEndpointUrl(siteUrl: string, operation: string): string {
    // Remove ?WSDL if present and ensure proper web service URL format
    const baseUrl = siteUrl.replace('?WSDL', '').replace(/\/$/, '');

    // Ensure the base URL includes the web service path
    let webServiceUrl = baseUrl;
    if (!baseUrl.includes('/mgWebService.asmx')) {
      // If the base URL doesn't include the web service path, add it
      if (baseUrl.endsWith('/democracy') || baseUrl.endsWith('/democracy/')) {
        webServiceUrl = `${baseUrl.replace(/\/democracy\/?$/, '')}/democracy/mgWebService.asmx`;
      } else if (!baseUrl.includes('/mgWebService.asmx')) {
        // Try to construct the web service URL by appending the path
        const urlParts = baseUrl.split('://');
        if (urlParts.length === 2) {
          const domain = urlParts[1].split('/')[0];
          webServiceUrl = `https://${domain}/mgWebService.asmx`;
        } else {
          // Fallback: assume the baseUrl is the domain
          webServiceUrl = `https://${baseUrl.replace(/^https?:\/\//, '')}/mgWebService.asmx`;
        }
      }
    }

    return `${webServiceUrl}/${operation}`;
  }

  private async parseCouncillorsResponse(xmlData: string): Promise<Ward[]> {
    try {
      const result = await parseStringPromise(xmlData, {
        explicitArray: false,
        ignoreAttrs: true,
        trim: true
      });

      const response = result as any;

      // Handle different possible root element names
      const rootElement = response.councillorsbyward || response.councillorsbywardid || response.councillorsbypostcode;

      if (!rootElement || !rootElement.wards || !rootElement.wards.ward) {
        return [];
      }

      const wards = Array.isArray(rootElement.wards.ward)
        ? rootElement.wards.ward
        : [rootElement.wards.ward];

      return wards.map((ward: any) => ({
        wardtitle: ward.wardtitle || '',
        councillors: {
          councillorcount: ward.councillors?.councillorcount || '0',
          councillor: Array.isArray(ward.councillors?.councillor)
            ? ward.councillors.councillor
            : ward.councillors?.councillor ? [ward.councillors.councillor] : []
        }
      }));
    } catch (error) {
      console.error('Error parsing XML response:', error);
      throw new Error('Failed to parse API response');
    }
  }

  private async parseCommitteesResponse(xmlData: string): Promise<Committee[]> {
    try {
      const result = await parseStringPromise(xmlData, {
        explicitArray: false,
        ignoreAttrs: true,
        trim: true
      });

      const response = result as any;
      const committeesElement = response.committees;

      if (!committeesElement || !committeesElement.committee) {
        return [];
      }

      const committees = Array.isArray(committeesElement.committee)
        ? committeesElement.committee
        : [committeesElement.committee];

      return committees.map((committee: any) => ({
        committeeid: committee.committeeid || '',
        committeetitle: committee.committeetitle || '',
        committeedescription: committee.committeedescription || '',
        committeetype: committee.committeetype || ''
      }));
    } catch (error) {
      console.error('Error parsing committees XML response:', error);
      throw new Error('Failed to parse committees response');
    }
  }

  private async parseMeetingsResponse(xmlData: any): Promise<Meeting[]> {
    try {
      // Ensure xmlData is a string
      const xmlString = typeof xmlData === 'string' ? xmlData : String(xmlData || '');

      // Check if response is empty or looks like HTML error page instead of XML
      if (!xmlString || xmlString.trim() === '') {
        throw new Error('Server returned empty response. This usually indicates a server-side bug or missing parameters.');
      }

      // Check for non-XML responses (like HTML error pages or JSON)
      if (!xmlString.trim().startsWith('<?xml') && !xmlString.trim().startsWith('<')) {
        throw new Error(`Server returned non-XML response: "${xmlString.substring(0, 100)}...". Expected XML data but got different format. This usually indicates a server-side bug or missing parameters.`);
      }

      // Check if response looks like HTML error page
      if (xmlString.trim().startsWith('<!DOCTYPE') || xmlString.trim().startsWith('<html') ||
          xmlString.trim().startsWith('<HTML') || xmlString.includes('<title>') && xmlString.includes('Error')) {
        throw new Error(`Server returned HTML error page instead of XML data. This usually indicates a server-side bug or missing parameters. Response preview: ${xmlString.substring(0, 200)}...`);
      }

      const result = await parseStringPromise(xmlString, {
        explicitArray: false,
        ignoreAttrs: true,
        trim: true
      });

      const response = result as any;

      // Handle different XML structures based on endpoint

      // Structure 1: getmeetings (from GetMeetings endpoint)
      const getmeetings = response.getmeetings;
      if (getmeetings) {
        // Structure 1a: Full committee structure (Lichfield style)
        if (getmeetings.committee) {
          const committee = getmeetings.committee;
          const committeeMeetings = committee.committeemeetings;

          if (!committeeMeetings || !committeeMeetings.meeting) {
            return [];
          }

          const meetings = Array.isArray(committeeMeetings.meeting)
            ? committeeMeetings.meeting
            : [committeeMeetings.meeting];

          return meetings.map((meeting: any) => ({
            meetingid: meeting.meetingid || '',
            meetingtitle: meeting.meetingstatus || 'Council Meeting',
            meetingdate: meeting.meetingdate || '',
            meetingtime: meeting.meetingtime || '',
            meetinglocation: '',
            committeeid: committee.committeeid || '',
            committeetitle: committee.committeetitle || ''
          }));
        }

        // Structure 1b: Simple count structure (Sutton style)
        if (getmeetings.meetingscount !== undefined) {
          // This structure only contains counts, no actual meetings
          // Return empty array since there are no meetings to parse
          return [];
        }
      }

      // Structure 2: getmeetingsbydate (from GetAllMeetingsByDate endpoint)
      const getmeetingsbydate = response.getmeetingsbydate;
      if (getmeetingsbydate && getmeetingsbydate.meetings) {
        const meetingsContainer = getmeetingsbydate.meetings;

        if (!meetingsContainer || !meetingsContainer.meeting) {
          return [];
        }

        const meetings = Array.isArray(meetingsContainer.meeting)
          ? meetingsContainer.meeting
          : [meetingsContainer.meeting];

        return meetings.map((meeting: any) => ({
          meetingid: meeting.meetingid || '',
          meetingtitle: meeting.meetingstatus || 'Council Meeting',
          meetingdate: meeting.meetingdate || '',
          meetingtime: meeting.meetingtime || '',
          meetinglocation: '',
          committeeid: meeting.committeeid || '',
          committeetitle: meeting.committeetitle || ''
        }));
      }

      // If neither structure is found, return empty array
      return [];
    } catch (error) {
      console.error('Error parsing meetings XML response:', error);
      throw new Error('Failed to parse meetings response');
    }
  }

  private async parseCalendarEventsResponse(xmlData: string): Promise<CalendarEvent[]> {
    try {
      const result = await parseStringPromise(xmlData, {
        explicitArray: false,
        ignoreAttrs: true,
        trim: true
      });

      const response = result as any;
      const eventsElement = response.calendarevents;

      if (!eventsElement || !eventsElement.event) {
        return [];
      }

      const events = Array.isArray(eventsElement.event)
        ? eventsElement.event
        : [eventsElement.event];

      return events.map((event: any) => ({
        eventid: event.eventid || '',
        eventtitle: event.eventtitle || '',
        eventdate: event.eventdate || '',
        eventdescription: event.eventdescription || '',
        eventlocation: event.eventlocation || ''
      }));
    } catch (error) {
      console.error('Error parsing calendar events XML response:', error);
      throw new Error('Failed to parse calendar events response');
    }
  }

  private async parseParishCouncilsResponse(xmlData: string): Promise<ParishCouncil[]> {
    try {
      const result = await parseStringPromise(xmlData, {
        explicitArray: false,
        ignoreAttrs: true,
        trim: true
      });

      const response = result as any;
      const councilsElement = response.parishcouncils;

      if (!councilsElement || !councilsElement.parishcouncil) {
        return [];
      }

      const councils = Array.isArray(councilsElement.parishcouncil)
        ? councilsElement.parishcouncil
        : [councilsElement.parishcouncil];

      return councils.map((council: any) => ({
        parishcouncilid: council.parishcouncilid || '',
        parishcounciltitle: council.parishcounciltitle || '',
        parishcouncilwebsite: council.parishcouncilwebsite || '',
        parishcouncilcontact: council.parishcouncilcontact || ''
      }));
    } catch (error) {
      console.error('Error parsing parish councils XML response:', error);
      throw new Error('Failed to parse parish councils response');
    }
  }

  private async parseElectionResultsResponse(xmlData: string): Promise<ElectionResult[]> {
    try {
      const result = await parseStringPromise(xmlData, {
        explicitArray: false,
        ignoreAttrs: true,
        trim: true
      });

      const response = result as any;
      const resultsElement = response.electionresults;

      if (!resultsElement || !resultsElement.electionresult) {
        return [];
      }

      const results = Array.isArray(resultsElement.electionresult)
        ? resultsElement.electionresult
        : [resultsElement.electionresult];

      return results.map((result: any) => ({
        electionid: result.electionid || '',
        electiontitle: result.electiontitle || '',
        electiondate: result.electiondate || '',
        results: result.results || []
      }));
    } catch (error) {
      console.error('Error parsing election results XML response:', error);
      throw new Error('Failed to parse election results response');
    }
  }

  private async parseWebCastMeetingsResponse(xmlData: string): Promise<WebCastMeeting[]> {
    try {
      const result = await parseStringPromise(xmlData, {
        explicitArray: false,
        ignoreAttrs: true,
        trim: true
      });

      const response = result as any;

      // Handle both webcastmeetings and getmeetings structures
      let meetingsElement = response.webcastmeetings;

      // If webcastmeetings structure doesn't exist, try getmeetings (same as regular meetings)
      if (!meetingsElement) {
        const getmeetings = response.getmeetings;
        if (getmeetings && getmeetings.committee) {
          // Extract meetings from the committee structure (same as regular meetings)
          const committees = Array.isArray(getmeetings.committee)
            ? getmeetings.committee
            : [getmeetings.committee];

          const allMeetings: any[] = [];
          committees.forEach((committee: any) => {
            if (committee.meeting) {
              const meetings = Array.isArray(committee.meeting)
                ? committee.meeting
                : [committee.meeting];
              allMeetings.push(...meetings);
            }
          });

          // Convert regular meetings to webcast meetings format
          return allMeetings.map((meeting: any) => ({
            meetingid: meeting.id || '',
            meetingtitle: meeting.title || '',
            webcasturl: meeting.webcasturl || '', // May be empty for non-webcast meetings
            meetingdate: meeting.date || ''
          }));
        }
      }

      // Original webcastmeetings parsing
      if (!meetingsElement || !meetingsElement.webcastmeeting) {
        return [];
      }

      const meetings = Array.isArray(meetingsElement.webcastmeeting)
        ? meetingsElement.webcastmeeting
        : [meetingsElement.webcastmeeting];

      return meetings.map((meeting: any) => ({
        meetingid: meeting.meetingid || '',
        meetingtitle: meeting.meetingtitle || '',
        webcasturl: meeting.webcasturl || '',
        meetingdate: meeting.meetingdate || ''
      }));
    } catch (error) {
      console.error('Error parsing webcast meetings XML response:', error);
      throw new Error('Failed to parse webcast meetings response');
    }
  }

  private async parseMpOrMepsAndWardsResponse(xmlData: string): Promise<MpOrMepInfo[]> {
    try {
      const result = await parseStringPromise(xmlData, {
        explicitArray: false,
        ignoreAttrs: true,
        trim: true
      });

      const response = result as any;
      const mpsElement = response.mpswards;

      if (!mpsElement || !mpsElement.mps || !mpsElement.mps.mp) {
        return [];
      }

      const mps = Array.isArray(mpsElement.mps.mp)
        ? mpsElement.mps.mp
        : [mpsElement.mps.mp];

      return mps.map((mp: any) => ({
        mpid: mp.mpid || '',
        mpname: mp.fullusername || '', // API uses fullusername instead of mpname
        constituency: mp.constituency || '',
        party: mp.politicalpartytitle || '', // API uses politicalpartytitle
        wards: mp.wards || []
      }));
    } catch (error) {
      console.error('Error parsing MP/MEP XML response:', error);
      throw new Error('Failed to parse MP/MEP response');
    }
  }

  private async checkRateLimit(siteUrl: string): Promise<void> {
    const domain = new URL(siteUrl).hostname;
    const now = Date.now();
    const lastRequest = this.rateLimiter.get(domain) || 0;

    if (now - lastRequest < this.rateLimitMs) {
      const waitTime = this.rateLimitMs - (now - lastRequest);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.rateLimiter.set(domain, Date.now());
  }
}
