/*
 * Copyright (C)2018 medozs and/or its affiliates
 * and other contributors as indicated by the @author tags.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.s
 */

import { Injectable } from "@angular/core";
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpHeaders
} from "@angular/common/http";
import { Observable } from "rxjs/Observable";
import { RouterExtensions } from "nativescript-angular/router";
import { HttpClient } from "@angular/common/http";
import { Subscription } from "rxjs";
import { timer } from "rxjs/observable/timer"
import "rxjs/add/observable/of";
import "rxjs/add/operator/map";

@Injectable()
export class AuthService  {
    constructor(private router: RouterExtensions, private http: HttpClient ) {

    }
    private accessToken: string;
    private refreshToken: string;
    private accessTimer: Subscription;
    private refreshTimer: Subscription;
    private _isAuthenticated: boolean;
    private readonly DELAYTIME: number = 10 * 1000;
    private options = {
        headers: new HttpHeaders().set("Content-Type", "application/x-www-form-urlencoded")
    };
    public config: Config;
    public authenticated() {
        return this._isAuthenticated;
    }

    public getToken() {
        return this.accessToken;
    }

    public login() {
        this.accessToken = "";
        this.refreshToken = "";
        this._isAuthenticated = false;
        this.refreshTimer.unsubscribe();
        this.accessTimer.unsubscribe();
        this.router.navigate([this.config.loginRoute], { clearHistory: true });
    }
    public logout() {
        this.login();
    }

    private renewToken (res) {
        this.accessTimer = timer((res.expires_in * 1000) - this.DELAYTIME).subscribe(() => {
            this.http.post(`${this.config.host}/auth/realms/public/protocol/openid-connect/token`,
            `client_id=${this.config.clientId}&client_secret=${this.config.clientSecret}&redirect_uri=app&grant_type=refresh_token&refresh_token=${this.refreshToken}`,
            this.options).map(res2 => <IToken>res2).subscribe(res2 => {
                this.accessToken = res2.access_token;
                this.refreshToken = res2.refresh_token;
                this.renewToken(res2);
            }, (err) => this.login());
        }, (err) => console.error(err));
    }
    public init(code?: string) {
        this.accessToken = "";
        this.refreshToken = "";
        this._isAuthenticated = false;
        this.http.post(`${this.config.host}/auth/realms/public/protocol/openid-connect/token`,
        `client_id=${this.config.clientId}&client_secret=${this.config.clientSecret}&redirect_uri=app&grant_type=authorization_code&code=${code}`,
        this.options).map(res => <IToken>res).subscribe(res => {
            this.accessToken = res.access_token;
            this.refreshToken = res.refresh_token;
            this._isAuthenticated = true;
            this.router.navigate([this.config.homeRoute], { clearHistory: true });
            this.renewToken(res);
            this.refreshTimer = timer((res.refresh_expires_in * 1000) - this.DELAYTIME).subscribe(() => {
                this.login();
            });
        }, (err) => console.error(err));
    }
}

interface IToken {
    "access_token": string;
    "expires_in": number;
    "refresh_expires_in": number;
    "refresh_token": string;
    "token_type": string;
    "id_token": string;
    "not-before-policy": number;
    "session_state": string;
}

export interface Config {
    clientId: string;
    clientSecret: string;
    host: string;
    loginRoute: string;
    homeRoute: string;
}


@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private authService: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {

    const token = `Bearer ${this.authService.getToken()}`;
    req = req.clone({
      setHeaders: {
        Authorization: token
      }
    });
    return next.handle(req);
  }
}
