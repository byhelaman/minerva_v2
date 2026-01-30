import { PublicClientApplication } from "@azure/msal-browser";
import { loginRequest } from "@/config/authConfig";

export class GraphService {
    private instance: PublicClientApplication;

    constructor(instance: PublicClientApplication) {
        this.instance = instance;
    }

    private async getToken(): Promise<string> {
        const account = this.instance.getActiveAccount();
        if (!account) {
            throw Error("No active account! Verify a user has been signed in and setActiveAccount has been called.");
        }

        const response = await this.instance.acquireTokenSilent({
            ...loginRequest,
            account: account
        });

        return response.accessToken;
    }

    private async callGraph(endpoint: string) {
        const token = await this.getToken();
        const headers = new Headers();
        const bearer = `Bearer ${token}`;

        headers.append("Authorization", bearer);

        const options = {
            method: "GET",
            headers: headers
        };

        const response = await fetch(endpoint, options);
        return await response.json();
    }

    private async postGraph(endpoint: string, body: any) {
        const token = await this.getToken();
        const headers = new Headers();
        const bearer = `Bearer ${token}`;

        headers.append("Authorization", bearer);
        headers.append("Content-Type", "application/json");

        const options = {
            method: "POST",
            headers: headers,
            body: JSON.stringify(body)
        };

        const response = await fetch(endpoint, options);
        return await response.json();
    }

    async getSharedItems() {
        return this.callGraph("https://graph.microsoft.com/v1.0/me/drive/sharedWithMe");
    }

    async getDriveChildren(driveId?: string, itemId?: string) {
        let endpoint = "https://graph.microsoft.com/v1.0/me/drive/root/children"; // Por defecto: Raíz de Mi Unidad

        if (driveId && itemId) {
            // Carpeta específica en unidad específica (podría ser compartida)
            endpoint = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/children`;
        } else if (driveId) {
            // Raíz de unidad específica
            endpoint = `https://graph.microsoft.com/v1.0/drives/${driveId}/root/children`;
        } else if (itemId) {
            // Carpeta específica en Mi Unidad
            endpoint = `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}/children`;
        }

        return this.callGraph(endpoint);
    }

    async createWorkbook(name: string, driveId?: string, parentId?: string) {
        const body = {
            name: name.endsWith('.xlsx') ? name : `${name}.xlsx`,
            file: {},
            "@microsoft.graph.conflictBehavior": "rename"
        };

        let endpoint = "https://graph.microsoft.com/v1.0/me/drive/root/children";

        if (driveId && parentId) {
            endpoint = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${parentId}/children`;
        } else if (parentId) {
            endpoint = `https://graph.microsoft.com/v1.0/me/drive/items/${parentId}/children`;
        }

        return this.postGraph(endpoint, body);
    }

    async getWorkbookTables(driveId: string, fileId: string) {
        // GET /drives/{drive-id}/items/{item-id}/workbook/tables
        const endpoint = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${fileId}/workbook/tables`;
        return this.callGraph(endpoint);
    }

    async getTableRows(driveId: string, fileId: string, tableName: string) {
        // GET /drives/{drive-id}/items/{item-id}/workbook/tables/{table-name}/rows
        const endpoint = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${fileId}/workbook/tables/${tableName}/rows`;
        return this.callGraph(endpoint);
    }
}
