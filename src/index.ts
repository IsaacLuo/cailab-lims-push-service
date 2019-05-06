import { ICustomState, IEmailVerification } from './types';
import koa from 'koa';
import koaBody from 'koa-body';
import Router from 'koa-router';
import route from 'koa-route';
import log4js from 'log4js';
import conf from '../conf';
import crypto from 'crypto';
import { User, EmailVerification, Portrait } from './models';
import jwt from 'jsonwebtoken';
import cors from 'koa-cors';
import nodemailer from 'nodemailer';
import uuid from 'uuid';
import sharp from 'sharp';
import fs from 'fs';
import util from 'util';
import koaWebsocket, { MiddlewareContext } from 'koa-websocket';
import * as ws from 'ws';

const app = koaWebsocket(new koa());

interface ISocketDict {
  [key: string]: {sockets: ws[]};
}

const socketDict:ISocketDict = {};

app.ws.use(route.all('/ws/notification', (ctx:MiddlewareContext)=> {
  let token = ctx.query.token;
  // if (token === undefined) {
  //   token = ctx.cookies.get('token');
  // }
  if (token === undefined) {
    console.log('no token')
    ctx.websocket.send(`no token`);
    ctx.websocket.close(401, 'no token');
    ctx.websocket.off
    ctx.throw(401);
    return;
  }
  if(!socketDict[token]) {
    socketDict[token] = {sockets:[]};
  }
  socketDict[token].sockets.push(ctx.websocket);
  console.log('token=', token);
  ctx.websocket.on('message', function(message) {
    // do something with the message from client
      console.log(message);
      ctx.websocket.send(`you sent ${message}`);
  });
}));

app.use(cors({credentials: true}));
app.use(koaBody());

app.use(route.post('/api/notification', (ctx)=> {
  // console.log('notification', ctx.request.body);
  const {token} = ctx.headers;
  if (token!==conf.secret.POST_MESSAGE_TOKEN) {
    ctx.throw(401);
  }

  let {targetTokens} = ctx.request.body;
  if (targetTokens === undefined) {
    targetTokens = [];
  }
  // console.log(targetTokens);
  // if (targetTokens === undefined) {
  //   targetTokens = Object.keys(socketDict);
  // }
  let sentCount = 0;
  targetTokens.forEach(targetToken => {
    if(socketDict[targetToken]) {
      // console.log('sending message to ', targetToken);
      socketDict[targetToken].sockets = socketDict[targetToken].sockets.filter(socket=>socket.readyState === socket.OPEN || socket.readyState === socket.CONNECTING);
      socketDict[targetToken].sockets.forEach(socket=>{
        if (socket.readyState === socket.OPEN) {
          socket.send(JSON.stringify(ctx.request.body.data));
          sentCount++;
        }
      });
    }
  });
  ctx.body = {sentCount};
}));

app.listen(8888,'0.0.0.0');
