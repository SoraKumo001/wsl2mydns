import * as request from "request-promise";
import { JSDOM } from "jsdom";

/**
 *MyDNSドメイン情報
 *
 * @interface MyDNSDomainInfo
 */
interface MyDNSDomainInfo {
  domainname: string;
  update: Date | null;
  ipV4: string | null;
  ipV6: string | null;
  mx: string[];
  prio: number[];
  hostname: string[];
  type: string[];
  content: string[];
  delegateid: string[];
}
/**
 *MyDNS子アカウント情報
 *
 * @interface MyDNSChildInfo
 */
interface MyDNSChildInfo {
  masterid: string[];
  domainname: string[];
  ipv4addr: string[];
  ipv6addr: string[];
  iplastdate: Date[];
}
/**
 *MyDNS情報統合用
 *
 * @interface MyDNSInfo
 */
interface MyDNSInfo {
  domainInfo: MyDNSDomainInfo;
  childInfo: MyDNSChildInfo;
}

/**
 *MyDNS情報取得用クラス
 *
 * @export
 * @class MyDNSReader
 */
export class MyDNSReader {
  mJar = request.jar();
  /**
   *ログインとセッション情報の取得
   *
   * @param {string} id   MyDNSのID
   * @param {string} pass MyDNSのパスワード
   * @returns {Promise<boolean>}
   * @memberof MyDNSReader
   */
  async getSession(id: string, pass: string): Promise<boolean> {
    var options = {
      jar: this.mJar,
      url: "https://www.mydns.jp/",
      method: "POST",
      transform: (body: string, response: any) => {
        return { headers: response.headers, body: body };
      },
      form: {
        MENU: 100,
        masterid: id,
        masterpwd: pass
      }
    };
    let value = (await request(options).catch(() => null)) as {
      headers: string[];
      body: string;
    };
    if (value && value.body && value.body.indexOf("./?MENU=090") >= 0) {
      return true;
    }
    return false;
  }

  /**
   *MyDNSの情報を取得
   *
   * @returns {Promise<MyDNSInfo>}
   * @memberof MyDNSReader
   */
  async getInfo(): Promise<MyDNSInfo | null> {
    const childInfo = this.getChildInfo();
    const domainInfo = this.getDomainInfo();
    const values = await Promise.all([childInfo, domainInfo]).catch(() => {
      return null;
    });
    if (values === null || values[0] === null || values[1] === null)
      return null;
    return { childInfo: values[0], domainInfo: values[1] } as MyDNSInfo;
  }
  /**
   *MyDNSの子アカウント情報の取得
   *
   * @returns {Promise<MyDNSChildInfo>}
   * @memberof MyDNSReader
   */
  async getChildInfo(): Promise<MyDNSChildInfo | null> {
    var options = {
      jar: this.mJar,
      url: "https://www.mydns.jp/",
      method: "GET",
      qs: { MENU: "200" }
    };
    let value: string | null = null;
    for (let i = 0; i < 5 && value === null; i++)
      value = await request(options).catch(() => null);
    if (value === null) return null;

    const info: MyDNSChildInfo = {
      masterid: [],
      domainname: [],
      ipv4addr: [],
      ipv6addr: [],
      iplastdate: []
    };
    const dom = new JSDOM(value);
    const doc = dom.window.document;
    for (let i = 0; ; i++) {
      const idElement = doc.querySelector(
        `INPUT[NAME="CHILDINFO[masterid][${i}]"]`
      ) as HTMLInputElement;
      if (!idElement) break;
      info.masterid[i] = idElement.value;
      const domainElement = doc.querySelector(
        `INPUT[NAME="CHILDINFO[domainname][${i}]"]`
      ) as HTMLInputElement;
      info.domainname[i] = domainElement.value;
      const ipv4Element = doc.querySelector(
        `INPUT[NAME="CHILDINFO[ipv4addr][${i}]"]`
      ) as HTMLInputElement;
      info.ipv4addr[i] = ipv4Element.value;
      const ipv6lement = doc.querySelector(
        `INPUT[NAME="CHILDINFO[ipv6addr][${i}]"]`
      ) as HTMLInputElement;
      info.ipv6addr[i] = ipv6lement.value;
      const updateElement = doc.querySelector(
        `INPUT[NAME="CHILDINFO[iplastdate][${i}]"]`
      ) as HTMLInputElement;
      info.iplastdate[i] = new Date(updateElement.value);
    }
    return info;
  }
  /**
   *MyDNSドメイン情報の取得
   *
   * @returns {Promise<MyDNSDomainInfo>}
   * @memberof MyDNSReader
   */
  async getDomainInfo(): Promise<MyDNSDomainInfo | null> {
    var options = {
      jar: this.mJar,
      url: "https://www.mydns.jp/",
      method: "GET",
      qs: { MENU: "300" }
    };
    let value: string | null = null;
    for (let i = 0; i < 5 && value === null; i++)
      value = await request(options).catch(() => null);
    if (value === null) return null;
    return MyDNSReader.getParams(new JSDOM(value));
  }
  /**
   *ドメイン情報パラメータ解析
   *
   * @private
   * @static
   * @param {JSDOM} dom
   * @returns {MyDNSDomainInfo}
   * @memberof MyDNSReader
   */
  private static getParams(dom: JSDOM): null | MyDNSDomainInfo {
    try {
      let params: MyDNSDomainInfo = {
        domainname: "",
        update: null,
        ipV4: null,
        ipV6: null,
        mx: [] as string[],
        prio: [] as number[],
        hostname: [] as string[],
        type: [] as string[],
        content: [] as string[],
        delegateid: [] as string[]
      };
      const doc = dom.window.document;
      const ipAddress = doc.querySelector("FONT.userinfo12") as HTMLFontElement;
      const ipText = ipAddress.textContent || "";
      const ip = ipText.match(
        /IPv4\(A\):([\d\.]*?), IPv6\(AAAA\):(.*?)\. (?:Last IP notify:(.*)|Please)/
      );
      if (ip) {
        if (ip.length >= 3) {
          params.ipV4 = ip[1];
          params.ipV6 = ip[2];
        }
        if (ip.length === 4) {
          if (ip[3]) params.update = ip[3] ? new Date(ip[3]) : null;
        }
      }

      const domainName = doc.querySelector(
        'INPUT[name="DNSINFO[domainname]"]'
      ) as HTMLInputElement;
      params.domainname = domainName.value;
      for (let i = 0; ; i++) {
        const mx = doc.querySelector(
          `INPUT[name="DNSINFO[mx][${i}]"]`
        ) as HTMLInputElement;
        if (!mx) break;
        params.mx[i] = mx.value;
        const prio = doc.querySelector(
          `SELECT[name="DNSINFO[prio][${i}]"]`
        ) as HTMLInputElement;
        params.prio[i] = parseInt(prio.value);
      }
      for (let i = 0; ; i++) {
        const hostname = doc.querySelector(
          `INPUT[name="DNSINFO[hostname][${i}]"]`
        ) as HTMLInputElement;
        if (!hostname) break;
        params.hostname[i] = hostname.value;
        const type = doc.querySelector(
          `SELECT[name="DNSINFO[type][${i}]"]`
        ) as HTMLInputElement;
        params.type[i] = type.value;
        const content = doc.querySelector(
          `INPUT[name="DNSINFO[content][${i}]"]`
        ) as HTMLInputElement;
        params.content[i] = content.value;
        const delegateid = doc.querySelector(
          `SELECT[name="DNSINFO[delegateid][${i}]"]`
        ) as HTMLInputElement;
        params.delegateid[i] = delegateid.value;
      }
      return params;
    } catch (e) {
      return null;
    }
  }
  /**
   *MyDNS情報設定
   *
   * @param {MyDNSDomainInfo} params
   * @returns {Promise<boolean>}
   * @memberof MyDNSReader
   */
  async setSetting(params: MyDNSDomainInfo): Promise<boolean> {
    const options = {
      jar: this.mJar,
      url: "https://www.mydns.jp/",
      method: "POST",
      form: {
        MENU: 300,
        JOB: "CHECK"
      }
    };
    const form: { [key: string]: string | number } = options.form;
    form["DNSINFO[domainname]"] = params.domainname;
    for (let i = 0; params.mx[i]; i++) {
      form[`DNSINFO[mx][${i}]`] = params.mx[i];
      form[`DNSINFO[prio][${i}]`] = params.prio[i];
    }
    for (let i = 0; params.hostname[i]; i++) {
      form[`DNSINFO[hostname][${i}]`] = params.hostname[i];
      form[`DNSINFO[type][${i}]`] = params.type[i];
      form[`DNSINFO[content][${i}]`] = params.content[i];
      form[`DNSINFO[delegateid][${i}]`] = params.delegateid[i];
    }
    let value = await request(options).catch(() => null);
    if (
      value &&
      value.indexOf('<INPUT type="hidden" name="JOB" value="CHANGE">') >= 0
    ) {
      const options = {
        jar: this.mJar,
        url: "https://www.mydns.jp/",
        method: "POST",
        form: {
          MENU: 300,
          JOB: "CHANGE"
        }
      };
      let value = await request(options).catch(() => null);
      if (value && value.indexOf("We accepted your Domain") >= 0) return true;
    }
    return false;
  }
  async setDirectIp(ipAddress:string): Promise<boolean> {
    const options = {
      jar: this.mJar,
      url: "https://www.mydns.jp/",
      method: "POST",
      form: {
        MENU: 400,
        JOB: "CHECK",
        "IPINFO[ipv4addr]":ipAddress,
        "IPINFO[ipv4mode]": 1,
        "IPINFO[ipv6addr]": "0:0:0:0:0:0:0:0",
        "IPINFO[ipv6mode]": 0,
      }
    };
    let value = await request(options).catch(() => null);
    if (
      value &&
      value.indexOf('<INPUT type="hidden" name="JOB" value="CHANGE">') >= 0
    ) {
      const options = {
        jar: this.mJar,
        url: "https://www.mydns.jp/",
        method: "POST",
        form: {
          MENU: 400,
          JOB: "CHANGE"
        }
      };
      let value = await request(options).catch(() => null);
      if (value && value.indexOf("We accepted your IP address registration") >= 0) return true;
    }
    return false;
  }
}
