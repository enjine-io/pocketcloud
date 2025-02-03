/** Tern web worker, which is used by default
 * This file also contains all files that are needed for the web worker to run (the server can load files on demand, but its messy to have all these files for once peice of ace functionality) *
 *
 *
 * Last updated 4/8/2015
 * Versions:
 *      Acorn: 1.0.1
 *      Tern:  0.10.0
 *
 * NOTE: in order to get latest acorn version you now must get from NPM or manually build Acorn source. Easiest way is to create a new folder and use: npm install acorn
 * 
 * NOTE: There is a bug with chrome.fileSystem that makes saving this file (specifically acorn.js) break (messes up UTF-8 encoding). https://code.google.com/p/chromium/issues/detail?id=474183. This file must be saved with a non-chrome app. If saved with a chrome app, then overwrting save wont fix, instead must delete file and save as new file from non-chrome app. 
 * 
 * NOTE: acorn_csp.js works without eval, but tern still has code that requires eval so there is no reason to use acorn_csp.
 */

// declare global: tern, server
/*jshint maxerr:10000 */


/**
 * this file used in web worker or normal javascript execution
 */
var isWorker = typeof window === 'undefined';

/**
 * this plugin is used in Caret-T chrome app.
 * tern can't run in a chrome app due to content security policy that disallows eval (which tern uses).
 * this code allows tern to work in chrome app using sandboxed iframe, so this worker file is not acutally
 * a worker in the chrome app.
 * 
 * This code is irrelevant for normal usage, set isChromeApp to false when not using in Caret-T chromeApp.
 *
 */
var isChromeApp = false;

if (isChromeApp) {
    var parentSource = null,
        parentOrigin = null;

    window.addEventListener('message', function(event) {
        if (parentSource === null) {
            parentSource = event.source;
            parentOrigin = event.origin;
        }
        onmessage(event);
    });

    window.postMessage = function(message) {
        parentSource.postMessage(message, parentOrigin);
    };
}

if (isWorker || isChromeApp) {
    if (isChromeApp) self = window;
    
    var server, nextId = 0,
        pending = {};

    self.onmessage = function(e) {
        //console.log('onmessage');
        var data = e.data;
        switch (data.type) {
        case "init":
            if (data.defs && data.defs.length > 0) {
                var tmp = [];
                for (var i = 0; i < data.defs.length; i++) {
                    tmp.push(getDefFromName(data.defs[i]));
                }
                data.defs = tmp;
            }
            return startServer(data.defs, data.plugins, data.scripts);
        case "add":
            return server.addFile(data.name, data.text);
        case "del":
            return server.delFile(data.name);
        case "req":
            //console.log('request received on server, data=',data.body);
            return server.request(data.body, function(err, reqData) {
                postMessage({
                    id: data.id,
                    body: reqData,
                    err: err && String(err)
                });
            });
        case "getFile":
            var c = pending[data.id];
            delete pending[data.id];
            return c(data.err, data.text);
        case "setDefs":
            return setDefs(data.defs);
        case "debug":
            debug(data.body);
            break;
        default:
            throw new Error("Unknown message type: " + data.type);
        }

        //Added for ace- sets defs as setting them on load is not ideal due to structure and the defs are stored in the worker file
        function setDefs(defs) {
            console.log('set defs in worker-tern.js does not work yet... it gets the file but setting the servers defs property is not enough to load the defs- this needs to be updated in tern to allow setting defs after load');
            try {
                server.defs = [];
                if (!defs || defs.length == 0) {
                    return;
                }
                for (var i = 0; i < defs.length; i++) {
                    server.defs.push(getDefFromName(defs[i]));
                    console.log(server.defs);
                }

            }
            catch (ex) {
                console.log('error setting tern defs (should be passed array) error: ' + ex);
            }
        }

        //(hack)- gets def from name at the bottom of this file (jquery,ecma5,browser,underscore)
        function getDefFromName(name) {
            try {
                if (typeof name !== 'string') return name;
                return eval('def_' + name);
            }
            catch (ex) {
                if (isWorker) console.log('error getting tern def (definition file) from name: ' + name);
                else console.log('error getting tern def (definition file) from name: ', name, ex);
                throw (ex);
            }
        }

        //(hack)- do something with debug messages
        function debug(message) {
            var r = '';
            if (message == "files" || message == 'filecontents') {
                for (var i = 0; i < server.files.length; i++) {
                    if (i > 0) r += '\n';
                    if (message == 'filecontents') {
                        r += 'file: ' + server.files[i].name + '\n\nbody:\n';
                        r += server.files[i].text + '\n\n\n';
                    }
                    else {
                        r += server.files[i].name;
                    }
                }
            }
            else {
                console.log("unknown debug message in tern worker:" + message);
            }
            if (r) {
                console.log('worker server debug - ' + message + '\n\n' + r);
            }
        }
    };

    self.getFile = function(file, c) {
        postMessage({
            type: "getFile",
            name: file,
            id: ++nextId
        });
        pending[nextId] = c;
    };

    self.startServer = function(defs, plugins, scripts) {
        console.log('tern: starting server');
        if (scripts) importScripts.apply(null, scripts);
        server = new tern.Server({
            getFile: getFile,
            async: true,
            defs: defs,
            plugins: plugins
        });
    };

    if (!self.console) self.console = {
        log: function(v) {
            postMessage({
                type: "debug",
                message: v
            });
        }
    };
}


//#region acorn/dist/acorn.js

(function(f) {
    if (typeof exports === "object" && typeof module !== "undefined") {
        module.exports = f()
    }
    else if (typeof define === "function" && define.amd) {
        define([], f)
    }
    else {
        var g;
        if (typeof window !== "undefined") {
            g = window
        }
        else if (typeof global !== "undefined") {
            g = global
        }
        else if (typeof self !== "undefined") {
            g = self
        }
        else {
            g = this
        }
        g.acorn = f()
    }
})(function() {
    var define, module, exports;
    return (function e(t, n, r) {
        function s(o, u) {
            if (!n[o]) {
                if (!t[o]) {
                    var a = typeof require == "function" && require;
                    if (!u && a) return a(o, !0);
                    if (i) return i(o, !0);
                    var f = new Error("Cannot find module '" + o + "'");
                    throw f.code = "MODULE_NOT_FOUND", f
                }
                var l = n[o] = {
                    exports: {}
                };
                t[o][0].call(l.exports, function(e) {
                    var n = t[o][1][e];
                    return s(n ? n : e)
                }, l, l.exports, e, t, n, r)
            }
            return n[o].exports
        }
        var i = typeof require == "function" && require;
        for (var o = 0; o < r.length; o++) s(r[o]);
        return s
    })({
        1: [function(_dereq_, module, exports) {


            // The main exported interface (under `self.acorn` when in the
            // browser) is a `parse` function that takes a code string and
            // returns an abstract syntax tree as specified by [Mozilla parser
            // API][api].
            //
            // [api]: https://developer.mozilla.org/en-US/docs/SpiderMonkey/Parser_API

            "use strict";

            exports.parse = parse;

            // This function tries to parse a single expression at a given
            // offset in a string. Useful for parsing mixed-language formats
            // that embed JavaScript expressions.

            exports.parseExpressionAt = parseExpressionAt;

            // Acorn is organized as a tokenizer and a recursive-descent parser.
            // The `tokenize` export provides an interface to the tokenizer.

            exports.tokenizer = tokenizer;
            Object.defineProperty(exports, "__esModule", {
                value: true
            });
            // Acorn is a tiny, fast JavaScript parser written in JavaScript.
            //
            // Acorn was written by Marijn Haverbeke, Ingvar Stepanyan, and
            // various contributors and released under an MIT license.
            //
            // Git repositories for Acorn are available at
            //
            //     http://marijnhaverbeke.nl/git/acorn
            //     https://github.com/marijnh/acorn.git
            //
            // Please use the [github bug tracker][ghbt] to report issues.
            //
            // [ghbt]: https://github.com/marijnh/acorn/issues
            //
            // This file defines the main parser interface. The library also comes
            // with a [error-tolerant parser][dammit] and an
            // [abstract syntax tree walker][walk], defined in other files.
            //
            // [dammit]: acorn_loose.js
            // [walk]: util/walk.js

            var _state = _dereq_("./state");

            var Parser = _state.Parser;

            var _options = _dereq_("./options");

            var getOptions = _options.getOptions;

            _dereq_("./parseutil");

            _dereq_("./statement");

            _dereq_("./lval");

            _dereq_("./expression");

            exports.Parser = _state.Parser;
            exports.plugins = _state.plugins;
            exports.defaultOptions = _options.defaultOptions;

            var _location = _dereq_("./location");

            exports.SourceLocation = _location.SourceLocation;
            exports.getLineInfo = _location.getLineInfo;
            exports.Node = _dereq_("./node").Node;

            var _tokentype = _dereq_("./tokentype");

            exports.TokenType = _tokentype.TokenType;
            exports.tokTypes = _tokentype.types;

            var _tokencontext = _dereq_("./tokencontext");

            exports.TokContext = _tokencontext.TokContext;
            exports.tokContexts = _tokencontext.types;

            var _identifier = _dereq_("./identifier");

            exports.isIdentifierChar = _identifier.isIdentifierChar;
            exports.isIdentifierStart = _identifier.isIdentifierStart;
            exports.Token = _dereq_("./tokenize").Token;

            var _whitespace = _dereq_("./whitespace");

            exports.isNewLine = _whitespace.isNewLine;
            exports.lineBreak = _whitespace.lineBreak;
            exports.lineBreakG = _whitespace.lineBreakG;
            var version = "1.0.2";
            exports.version = version;

            function parse(input, options) {
                var p = parser(options, input);
                var startPos = p.options.locations ? [p.pos, p.curPosition()] : p.pos;
                p.nextToken();
                return p.parseTopLevel(p.options.program || p.startNodeAt(startPos));
            }

            function parseExpressionAt(input, pos, options) {
                var p = parser(options, input, pos);
                p.nextToken();
                return p.parseExpression();
            }

            function tokenizer(input, options) {
                return parser(options, input);
            }

            function parser(options, input) {
                return new Parser(getOptions(options), String(input));
            }

        }, {
            "./expression": 2,
            "./identifier": 3,
            "./location": 4,
            "./lval": 5,
            "./node": 6,
            "./options": 7,
            "./parseutil": 8,
            "./state": 9,
            "./statement": 10,
            "./tokencontext": 11,
            "./tokenize": 12,
            "./tokentype": 13,
            "./whitespace": 15
        }],
        2: [function(_dereq_, module, exports) {
            // A recursive descent parser operates by defining functions for all
            // syntactic elements, and recursively calling those, each function
            // advancing the input stream and returning an AST node. Precedence
            // of constructs (for example, the fact that `!x[1]` means `!(x[1])`
            // instead of `(!x)[1]` is handled by the fact that the parser
            // function that parses unary prefix operators is called first, and
            // in turn calls the function that parses `[]` subscripts — that
            // way, it'll receive the node for `x[1]` already parsed, and wraps
            // *that* in the unary operator node.
            //
            // Acorn uses an [operator precedence parser][opp] to handle binary
            // operator precedence, because it is much more compact than using
            // the technique outlined above, which uses different, nesting
            // functions to specify precedence, for all of the ten binary
            // precedence levels that JavaScript defines.
            //
            // [opp]: http://en.wikipedia.org/wiki/Operator-precedence_parser

            "use strict";

            var tt = _dereq_("./tokentype").types;

            var Parser = _dereq_("./state").Parser;

            var reservedWords = _dereq_("./identifier").reservedWords;

            var has = _dereq_("./util").has;

            var pp = Parser.prototype;

            // Check if property name clashes with already added.
            // Object/class getters and setters are not allowed to clash —
            // either with each other or with an init property — and in
            // strict mode, init properties are also not allowed to be repeated.

            pp.checkPropClash = function(prop, propHash) {
                if (this.options.ecmaVersion >= 6) return;
                var key = prop.key,
                    name = undefined;
                switch (key.type) {
                case "Identifier":
                    name = key.name;
                    break;
                case "Literal":
                    name = String(key.value);
                    break;
                default:
                    return;
                }
                var kind = prop.kind || "init",
                    other = undefined;
                if (has(propHash, name)) {
                    other = propHash[name];
                    var isGetSet = kind !== "init";
                    if ((this.strict || isGetSet) && other[kind] || !(isGetSet ^ other.init)) this.raise(key.start, "Redefinition of property");
                }
                else {
                    other = propHash[name] = {
                        init: false,
                        get: false,
                        set: false
                    };
                }
                other[kind] = true;
            };

            // ### Expression parsing

            // These nest, from the most general expression type at the top to
            // 'atomic', nondivisible expression types at the bottom. Most of
            // the functions will simply let the function(s) below them parse,
            // and, *if* the syntactic construct they handle is present, wrap
            // the AST node that the inner parser gave them in another node.

            // Parse a full expression. The optional arguments are used to
            // forbid the `in` operator (in for loops initalization expressions)
            // and provide reference for storing '=' operator inside shorthand
            // property assignment in contexts where both object expression
            // and object pattern might appear (so it's possible to raise
            // delayed syntax error at correct position).

            pp.parseExpression = function(noIn, refShorthandDefaultPos) {
                var start = this.markPosition();
                var expr = this.parseMaybeAssign(noIn, refShorthandDefaultPos);
                if (this.type === tt.comma) {
                    var node = this.startNodeAt(start);
                    node.expressions = [expr];
                    while (this.eat(tt.comma)) node.expressions.push(this.parseMaybeAssign(noIn, refShorthandDefaultPos));
                    return this.finishNode(node, "SequenceExpression");
                }
                return expr;
            };

            // Parse an assignment expression. This includes applications of
            // operators like `+=`.

            pp.parseMaybeAssign = function(noIn, refShorthandDefaultPos) {
                if (this.type == tt._yield && this.inGenerator) return this.parseYield();

                var failOnShorthandAssign = undefined;
                if (!refShorthandDefaultPos) {
                    refShorthandDefaultPos = {
                        start: 0
                    };
                    failOnShorthandAssign = true;
                }
                else {
                    failOnShorthandAssign = false;
                }
                var start = this.markPosition();
                var left = this.parseMaybeConditional(noIn, refShorthandDefaultPos);
                if (this.type.isAssign) {
                    var node = this.startNodeAt(start);
                    node.operator = this.value;
                    node.left = this.type === tt.eq ? this.toAssignable(left) : left;
                    refShorthandDefaultPos.start = 0; // reset because shorthand default was used correctly
                    this.checkLVal(left);
                    this.next();
                    node.right = this.parseMaybeAssign(noIn);
                    return this.finishNode(node, "AssignmentExpression");
                }
                else if (failOnShorthandAssign && refShorthandDefaultPos.start) {
                    this.unexpected(refShorthandDefaultPos.start);
                }
                return left;
            };

            // Parse a ternary conditional (`?:`) operator.

            pp.parseMaybeConditional = function(noIn, refShorthandDefaultPos) {
                var start = this.markPosition();
                var expr = this.parseExprOps(noIn, refShorthandDefaultPos);
                if (refShorthandDefaultPos && refShorthandDefaultPos.start) return expr;
                if (this.eat(tt.question)) {
                    var node = this.startNodeAt(start);
                    node.test = expr;
                    node.consequent = this.parseMaybeAssign();
                    this.expect(tt.colon);
                    node.alternate = this.parseMaybeAssign(noIn);
                    return this.finishNode(node, "ConditionalExpression");
                }
                return expr;
            };

            // Start the precedence parser.

            pp.parseExprOps = function(noIn, refShorthandDefaultPos) {
                var start = this.markPosition();
                var expr = this.parseMaybeUnary(refShorthandDefaultPos);
                if (refShorthandDefaultPos && refShorthandDefaultPos.start) return expr;
                return this.parseExprOp(expr, start, - 1, noIn);
            };

            // Parse binary operators with the operator precedence parsing
            // algorithm. `left` is the left-hand side of the operator.
            // `minPrec` provides context that allows the function to stop and
            // defer further parser to one of its callers when it encounters an
            // operator that has a lower precedence than the set it is parsing.

            pp.parseExprOp = function(left, leftStart, minPrec, noIn) {
                var prec = this.type.binop;
                if (prec != null && (!noIn || this.type !== tt._in)) {
                    if (prec > minPrec) {
                        var node = this.startNodeAt(leftStart);
                        node.left = left;
                        node.operator = this.value;
                        var op = this.type;
                        this.next();
                        var start = this.markPosition();
                        node.right = this.parseExprOp(this.parseMaybeUnary(), start, prec, noIn);
                        this.finishNode(node, op === tt.logicalOR || op === tt.logicalAND ? "LogicalExpression" : "BinaryExpression");
                        return this.parseExprOp(node, leftStart, minPrec, noIn);
                    }
                }
                return left;
            };

            // Parse unary operators, both prefix and postfix.

            pp.parseMaybeUnary = function(refShorthandDefaultPos) {
                if (this.type.prefix) {
                    var node = this.startNode(),
                        update = this.type === tt.incDec;
                    node.operator = this.value;
                    node.prefix = true;
                    this.next();
                    node.argument = this.parseMaybeUnary();
                    if (refShorthandDefaultPos && refShorthandDefaultPos.start) this.unexpected(refShorthandDefaultPos.start);
                    if (update) this.checkLVal(node.argument);
                    else if (this.strict && node.operator === "delete" && node.argument.type === "Identifier") this.raise(node.start, "Deleting local variable in strict mode");
                    return this.finishNode(node, update ? "UpdateExpression" : "UnaryExpression");
                }
                var start = this.markPosition();
                var expr = this.parseExprSubscripts(refShorthandDefaultPos);
                if (refShorthandDefaultPos && refShorthandDefaultPos.start) return expr;
                while (this.type.postfix && !this.canInsertSemicolon()) {
                    var node = this.startNodeAt(start);
                    node.operator = this.value;
                    node.prefix = false;
                    node.argument = expr;
                    this.checkLVal(expr);
                    this.next();
                    expr = this.finishNode(node, "UpdateExpression");
                }
                return expr;
            };

            // Parse call, dot, and `[]`-subscript expressions.

            pp.parseExprSubscripts = function(refShorthandDefaultPos) {
                var start = this.markPosition();
                var expr = this.parseExprAtom(refShorthandDefaultPos);
                if (refShorthandDefaultPos && refShorthandDefaultPos.start) return expr;
                return this.parseSubscripts(expr, start);
            };

            pp.parseSubscripts = function(base, start, noCalls) {
                if (this.eat(tt.dot)) {
                    var node = this.startNodeAt(start);
                    node.object = base;
                    node.property = this.parseIdent(true);
                    node.computed = false;
                    return this.parseSubscripts(this.finishNode(node, "MemberExpression"), start, noCalls);
                }
                else if (this.eat(tt.bracketL)) {
                    var node = this.startNodeAt(start);
                    node.object = base;
                    node.property = this.parseExpression();
                    node.computed = true;
                    this.expect(tt.bracketR);
                    return this.parseSubscripts(this.finishNode(node, "MemberExpression"), start, noCalls);
                }
                else if (!noCalls && this.eat(tt.parenL)) {
                    var node = this.startNodeAt(start);
                    node.callee = base;
                    node.arguments = this.parseExprList(tt.parenR, false);
                    return this.parseSubscripts(this.finishNode(node, "CallExpression"), start, noCalls);
                }
                else if (this.type === tt.backQuote) {
                    var node = this.startNodeAt(start);
                    node.tag = base;
                    node.quasi = this.parseTemplate();
                    return this.parseSubscripts(this.finishNode(node, "TaggedTemplateExpression"), start, noCalls);
                }
                return base;
            };

            // Parse an atomic expression — either a single token that is an
            // expression, an expression started by a keyword like `function` or
            // `new`, or an expression wrapped in punctuation like `()`, `[]`,
            // or `{}`.

            pp.parseExprAtom = function(refShorthandDefaultPos) {
                var node = undefined;
                switch (this.type) {
                case tt._this:
                case tt._super:
                    var type = this.type === tt._this ? "ThisExpression" : "Super";
                    node = this.startNode();
                    this.next();
                    return this.finishNode(node, type);

                case tt._yield:
                    if (this.inGenerator) this.unexpected();

                case tt.name:
                    var start = this.markPosition();
                    var id = this.parseIdent(this.type !== tt.name);
                    if (!this.canInsertSemicolon() && this.eat(tt.arrow)) {
                        return this.parseArrowExpression(this.startNodeAt(start), [id]);
                    }
                    return id;

                case tt.regexp:
                    var value = this.value;
                    node = this.parseLiteral(value.value);
                    node.regex = {
                        pattern: value.pattern,
                        flags: value.flags
                    };
                    return node;

                case tt.num:
                case tt.string:
                    return this.parseLiteral(this.value);

                case tt._null:
                case tt._true:
                case tt._false:
                    node = this.startNode();
                    node.value = this.type === tt._null ? null : this.type === tt._true;
                    node.raw = this.type.keyword;
                    this.next();
                    return this.finishNode(node, "Literal");

                case tt.parenL:
                    return this.parseParenAndDistinguishExpression();

                case tt.bracketL:
                    node = this.startNode();
                    this.next();
                    // check whether this is array comprehension or regular array
                    if (this.options.ecmaVersion >= 7 && this.type === tt._for) {
                        return this.parseComprehension(node, false);
                    }
                    node.elements = this.parseExprList(tt.bracketR, true, true, refShorthandDefaultPos);
                    return this.finishNode(node, "ArrayExpression");

                case tt.braceL:
                    return this.parseObj(false, refShorthandDefaultPos);

                case tt._function:
                    node = this.startNode();
                    this.next();
                    return this.parseFunction(node, false);

                case tt._class:
                    return this.parseClass(this.startNode(), false);

                case tt._new:
                    return this.parseNew();

                case tt.backQuote:
                    return this.parseTemplate();

                default:
                    this.unexpected();
                }
            };

            pp.parseLiteral = function(value) {
                var node = this.startNode();
                node.value = value;
                node.raw = this.input.slice(this.start, this.end);
                this.next();
                return this.finishNode(node, "Literal");
            };

            pp.parseParenExpression = function() {
                this.expect(tt.parenL);
                var val = this.parseExpression();
                this.expect(tt.parenR);
                return val;
            };

            pp.parseParenAndDistinguishExpression = function() {
                var start = this.markPosition(),
                    val = undefined;
                if (this.options.ecmaVersion >= 6) {
                    this.next();

                    if (this.options.ecmaVersion >= 7 && this.type === tt._for) {
                        return this.parseComprehension(this.startNodeAt(start), true);
                    }

                    var innerStart = this.markPosition(),
                        exprList = [],
                        first = true;
                    var refShorthandDefaultPos = {
                        start: 0
                    },
                    spreadStart = undefined,
                        innerParenStart = undefined;
                    while (this.type !== tt.parenR) {
                        first ? first = false : this.expect(tt.comma);
                        if (this.type === tt.ellipsis) {
                            spreadStart = this.start;
                            exprList.push(this.parseRest());
                            break;
                        }
                        else {
                            if (this.type === tt.parenL && !innerParenStart) {
                                innerParenStart = this.start;
                            }
                            exprList.push(this.parseMaybeAssign(false, refShorthandDefaultPos));
                        }
                    }
                    var innerEnd = this.markPosition();
                    this.expect(tt.parenR);

                    if (!this.canInsertSemicolon() && this.eat(tt.arrow)) {
                        if (innerParenStart) this.unexpected(innerParenStart);
                        return this.parseArrowExpression(this.startNodeAt(start), exprList);
                    }

                    if (!exprList.length) this.unexpected(this.lastTokStart);
                    if (spreadStart) this.unexpected(spreadStart);
                    if (refShorthandDefaultPos.start) this.unexpected(refShorthandDefaultPos.start);

                    if (exprList.length > 1) {
                        val = this.startNodeAt(innerStart);
                        val.expressions = exprList;
                        this.finishNodeAt(val, "SequenceExpression", innerEnd);
                    }
                    else {
                        val = exprList[0];
                    }
                }
                else {
                    val = this.parseParenExpression();
                }

                if (this.options.preserveParens) {
                    var par = this.startNodeAt(start);
                    par.expression = val;
                    return this.finishNode(par, "ParenthesizedExpression");
                }
                else {
                    return val;
                }
            };

            // New's precedence is slightly tricky. It must allow its argument
            // to be a `[]` or dot subscript expression, but not a call — at
            // least, not without wrapping it in parentheses. Thus, it uses the

            var empty = [];

            pp.parseNew = function() {
                var node = this.startNode();
                var meta = this.parseIdent(true);
                if (this.options.ecmaVersion >= 6 && this.eat(tt.dot)) {
                    node.meta = meta;
                    node.property = this.parseIdent(true);
                    if (node.property.name !== "target") this.raise(node.property.start, "The only valid meta property for new is new.target");
                    return this.finishNode(node, "MetaProperty");
                }
                var start = this.markPosition();
                node.callee = this.parseSubscripts(this.parseExprAtom(), start, true);
                if (this.eat(tt.parenL)) node.arguments = this.parseExprList(tt.parenR, false);
                else node.arguments = empty;
                return this.finishNode(node, "NewExpression");
            };

            // Parse template expression.

            pp.parseTemplateElement = function() {
                var elem = this.startNode();
                elem.value = {
                    raw: this.input.slice(this.start, this.end),
                    cooked: this.value
                };
                this.next();
                elem.tail = this.type === tt.backQuote;
                return this.finishNode(elem, "TemplateElement");
            };

            pp.parseTemplate = function() {
                var node = this.startNode();
                this.next();
                node.expressions = [];
                var curElt = this.parseTemplateElement();
                node.quasis = [curElt];
                while (!curElt.tail) {
                    this.expect(tt.dollarBraceL);
                    node.expressions.push(this.parseExpression());
                    this.expect(tt.braceR);
                    node.quasis.push(curElt = this.parseTemplateElement());
                }
                this.next();
                return this.finishNode(node, "TemplateLiteral");
            };

            // Parse an object literal or binding pattern.

            pp.parseObj = function(isPattern, refShorthandDefaultPos) {
                var node = this.startNode(),
                    first = true,
                    propHash = {};
                node.properties = [];
                this.next();
                while (!this.eat(tt.braceR)) {
                    if (!first) {
                        this.expect(tt.comma);
                        if (this.afterTrailingComma(tt.braceR)) break;
                    }
                    else first = false;

                    var prop = this.startNode(),
                        isGenerator = undefined,
                        start = undefined;
                    if (this.options.ecmaVersion >= 6) {
                        prop.method = false;
                        prop.shorthand = false;
                        if (isPattern || refShorthandDefaultPos) start = this.markPosition();
                        if (!isPattern) isGenerator = this.eat(tt.star);
                    }
                    this.parsePropertyName(prop);
                    if (this.eat(tt.colon)) {
                        prop.value = isPattern ? this.parseMaybeDefault() : this.parseMaybeAssign(false, refShorthandDefaultPos);
                        prop.kind = "init";
                    }
                    else if (this.options.ecmaVersion >= 6 && this.type === tt.parenL) {
                        if (isPattern) this.unexpected();
                        prop.kind = "init";
                        prop.method = true;
                        prop.value = this.parseMethod(isGenerator);
                    }
                    else if (this.options.ecmaVersion >= 5 && !prop.computed && prop.key.type === "Identifier" && (prop.key.name === "get" || prop.key.name === "set") && (this.type != tt.comma && this.type != tt.braceR)) {
                        if (isGenerator || isPattern) this.unexpected();
                        prop.kind = prop.key.name;
                        this.parsePropertyName(prop);
                        prop.value = this.parseMethod(false);
                    }
                    else if (this.options.ecmaVersion >= 6 && !prop.computed && prop.key.type === "Identifier") {
                        prop.kind = "init";
                        if (isPattern) {
                            if (this.isKeyword(prop.key.name) || this.strict && (reservedWords.strictBind(prop.key.name) || reservedWords.strict(prop.key.name)) || !this.options.allowReserved && this.isReservedWord(prop.key.name)) this.raise(prop.key.start, "Binding " + prop.key.name);
                            prop.value = this.parseMaybeDefault(start, prop.key);
                        }
                        else if (this.type === tt.eq && refShorthandDefaultPos) {
                            if (!refShorthandDefaultPos.start) refShorthandDefaultPos.start = this.start;
                            prop.value = this.parseMaybeDefault(start, prop.key);
                        }
                        else {
                            prop.value = prop.key;
                        }
                        prop.shorthand = true;
                    }
                    else this.unexpected();

                    this.checkPropClash(prop, propHash);
                    node.properties.push(this.finishNode(prop, "Property"));
                }
                return this.finishNode(node, isPattern ? "ObjectPattern" : "ObjectExpression");
            };

            pp.parsePropertyName = function(prop) {
                if (this.options.ecmaVersion >= 6) {
                    if (this.eat(tt.bracketL)) {
                        prop.computed = true;
                        prop.key = this.parseMaybeAssign();
                        this.expect(tt.bracketR);
                        return;
                    }
                    else {
                        prop.computed = false;
                    }
                }
                prop.key = this.type === tt.num || this.type === tt.string ? this.parseExprAtom() : this.parseIdent(true);
            };

            // Initialize empty function node.

            pp.initFunction = function(node) {
                node.id = null;
                if (this.options.ecmaVersion >= 6) {
                    node.generator = false;
                    node.expression = false;
                }
            };

            // Parse object or class method.

            pp.parseMethod = function(isGenerator) {
                var node = this.startNode();
                this.initFunction(node);
                this.expect(tt.parenL);
                node.params = this.parseBindingList(tt.parenR, false, false);
                var allowExpressionBody = undefined;
                if (this.options.ecmaVersion >= 6) {
                    node.generator = isGenerator;
                    allowExpressionBody = true;
                }
                else {
                    allowExpressionBody = false;
                }
                this.parseFunctionBody(node, allowExpressionBody);
                return this.finishNode(node, "FunctionExpression");
            };

            // Parse arrow function expression with given parameters.

            pp.parseArrowExpression = function(node, params) {
                this.initFunction(node);
                node.params = this.toAssignableList(params, true);
                this.parseFunctionBody(node, true);
                return this.finishNode(node, "ArrowFunctionExpression");
            };

            // Parse function body and check parameters.

            pp.parseFunctionBody = function(node, allowExpression) {
                var isExpression = allowExpression && this.type !== tt.braceL;

                if (isExpression) {
                    node.body = this.parseMaybeAssign();
                    node.expression = true;
                }
                else {
                    // Start a new scope with regard to labels and the `inFunction`
                    // flag (restore them to their old value afterwards).
                    var oldInFunc = this.inFunction,
                        oldInGen = this.inGenerator,
                        oldLabels = this.labels;
                    this.inFunction = true;
                    this.inGenerator = node.generator;
                    this.labels = [];
                    node.body = this.parseBlock(true);
                    node.expression = false;
                    this.inFunction = oldInFunc;
                    this.inGenerator = oldInGen;
                    this.labels = oldLabels;
                }

                // If this is a strict mode function, verify that argument names
                // are not repeated, and it does not try to bind the words `eval`
                // or `arguments`.
                if (this.strict || !isExpression && node.body.body.length && this.isUseStrict(node.body.body[0])) {
                    var nameHash = {},
                    oldStrict = this.strict;
                    this.strict = true;
                    if (node.id) this.checkLVal(node.id, true);
                    for (var i = 0; i < node.params.length; i++) {
                        this.checkLVal(node.params[i], true, nameHash);
                    }
                    this.strict = oldStrict;
                }
            };

            // Parses a comma-separated list of expressions, and returns them as
            // an array. `close` is the token type that ends the list, and
            // `allowEmpty` can be turned on to allow subsequent commas with
            // nothing in between them to be parsed as `null` (which is needed
            // for array literals).

            pp.parseExprList = function(close, allowTrailingComma, allowEmpty, refShorthandDefaultPos) {
                var elts = [],
                    first = true;
                while (!this.eat(close)) {
                    if (!first) {
                        this.expect(tt.comma);
                        if (allowTrailingComma && this.afterTrailingComma(close)) break;
                    }
                    else first = false;

                    if (allowEmpty && this.type === tt.comma) {
                        elts.push(null);
                    }
                    else {
                        if (this.type === tt.ellipsis) elts.push(this.parseSpread(refShorthandDefaultPos));
                        else elts.push(this.parseMaybeAssign(false, refShorthandDefaultPos));
                    }
                }
                return elts;
            };

            // Parse the next token as an identifier. If `liberal` is true (used
            // when parsing properties), it will also convert keywords into
            // identifiers.

            pp.parseIdent = function(liberal) {
                var node = this.startNode();
                if (liberal && this.options.allowReserved == "never") liberal = false;
                if (this.type === tt.name) {
                    if (!liberal && (!this.options.allowReserved && this.isReservedWord(this.value) || this.strict && reservedWords.strict(this.value) && (this.options.ecmaVersion >= 6 || this.input.slice(this.start, this.end).indexOf("\\") == -1))) this.raise(this.start, "The keyword '" + this.value + "' is reserved");
                    node.name = this.value;
                }
                else if (liberal && this.type.keyword) {
                    node.name = this.type.keyword;
                }
                else {
                    this.unexpected();
                }
                this.next();
                return this.finishNode(node, "Identifier");
            };

            // Parses yield expression inside generator.

            pp.parseYield = function() {
                var node = this.startNode();
                this.next();
                if (this.type == tt.semi || this.canInsertSemicolon() || this.type != tt.star && !this.type.startsExpr) {
                    node.delegate = false;
                    node.argument = null;
                }
                else {
                    node.delegate = this.eat(tt.star);
                    node.argument = this.parseMaybeAssign();
                }
                return this.finishNode(node, "YieldExpression");
            };

            // Parses array and generator comprehensions.

            pp.parseComprehension = function(node, isGenerator) {
                node.blocks = [];
                while (this.type === tt._for) {
                    var block = this.startNode();
                    this.next();
                    this.expect(tt.parenL);
                    block.left = this.parseBindingAtom();
                    this.checkLVal(block.left, true);
                    this.expectContextual("of");
                    block.right = this.parseExpression();
                    this.expect(tt.parenR);
                    node.blocks.push(this.finishNode(block, "ComprehensionBlock"));
                }
                node.filter = this.eat(tt._if) ? this.parseParenExpression() : null;
                node.body = this.parseExpression();
                this.expect(isGenerator ? tt.parenR : tt.bracketR);
                node.generator = isGenerator;
                return this.finishNode(node, "ComprehensionExpression");
            };

        }, {
            "./identifier": 3,
            "./state": 9,
            "./tokentype": 13,
            "./util": 14
        }],
        3: [function(_dereq_, module, exports) {


            // Test whether a given character code starts an identifier.

            "use strict";

            exports.isIdentifierStart = isIdentifierStart;

            // Test whether a given character is part of an identifier.

            exports.isIdentifierChar = isIdentifierChar;
            Object.defineProperty(exports, "__esModule", {
                value: true
            });
            // This is a trick taken from Esprima. It turns out that, on
            // non-Chrome browsers, to check whether a string is in a set, a
            // predicate containing a big ugly `switch` statement is faster than
            // a regular expression, and on Chrome the two are about on par.
            // This function uses `eval` (non-lexical) to produce such a
            // predicate from a space-separated string of words.
            //
            // It starts by sorting the words by length.

            // Removed to create an eval-free library

            // Reserved word lists for various dialects of the language

            var reservedWords = {
                3: function anonymous(str) {
                    switch (str.length) {
                    case 6:
                        switch (str) {
                        case "double":
                        case "export":
                        case "import":
                        case "native":
                        case "public":
                        case "static":
                        case "throws":
                            return true
                        }
                        return false;
                    case 4:
                        switch (str) {
                        case "byte":
                        case "char":
                        case "enum":
                        case "goto":
                        case "long":
                            return true
                        }
                        return false;
                    case 5:
                        switch (str) {
                        case "class":
                        case "final":
                        case "float":
                        case "short":
                        case "super":
                            return true
                        }
                        return false;
                    case 7:
                        switch (str) {
                        case "boolean":
                        case "extends":
                        case "package":
                        case "private":
                            return true
                        }
                        return false;
                    case 9:
                        switch (str) {
                        case "interface":
                        case "protected":
                        case "transient":
                            return true
                        }
                        return false;
                    case 8:
                        switch (str) {
                        case "abstract":
                        case "volatile":
                            return true
                        }
                        return false;
                    case 10:
                        return str === "implements";
                    case 3:
                        return str === "int";
                    case 12:
                        return str === "synchronized";
                    }
                },
                5: function anonymous(str) {
                    switch (str.length) {
                    case 5:
                        switch (str) {
                        case "class":
                        case "super":
                        case "const":
                            return true
                        }
                        return false;
                    case 6:
                        switch (str) {
                        case "export":
                        case "import":
                            return true
                        }
                        return false;
                    case 4:
                        return str === "enum";
                    case 7:
                        return str === "extends";
                    }
                },
                6: function anonymous(str) {
                    switch (str) {
                    case "enum":
                    case "await":
                        return true
                    }
                    return false;
                },
                strict: function anonymous(str) {
                    switch (str.length) {
                    case 9:
                        switch (str) {
                        case "interface":
                        case "protected":
                            return true
                        }
                        return false;
                    case 7:
                        switch (str) {
                        case "package":
                        case "private":
                            return true
                        }
                        return false;
                    case 6:
                        switch (str) {
                        case "public":
                        case "static":
                            return true
                        }
                        return false;
                    case 10:
                        return str === "implements";
                    case 3:
                        return str === "let";
                    case 5:
                        return str === "yield";
                    }
                },
                strictBind: function anonymous(str) {
                    switch (str) {
                    case "eval":
                    case "arguments":
                        return true
                    }
                    return false;
                }
            };

            exports.reservedWords = reservedWords;
            // And the keywords

            var ecma5AndLessKeywords = "break case catch continue debugger default do else finally for function if return switch throw try var while with null true false instanceof typeof void delete new in this";

            var keywords = {
                5: function anonymous(str) {
                    switch (str.length) {
                    case 4:
                        switch (str) {
                        case "case":
                        case "else":
                        case "with":
                        case "null":
                        case "true":
                        case "void":
                        case "this":
                            return true
                        }
                        return false;
                    case 5:
                        switch (str) {
                        case "break":
                        case "catch":
                        case "throw":
                        case "while":
                        case "false":
                            return true
                        }
                        return false;
                    case 3:
                        switch (str) {
                        case "for":
                        case "try":
                        case "var":
                        case "new":
                            return true
                        }
                        return false;
                    case 6:
                        switch (str) {
                        case "return":
                        case "switch":
                        case "typeof":
                        case "delete":
                            return true
                        }
                        return false;
                    case 8:
                        switch (str) {
                        case "continue":
                        case "debugger":
                        case "function":
                            return true
                        }
                        return false;
                    case 2:
                        switch (str) {
                        case "do":
                        case "if":
                        case "in":
                            return true
                        }
                        return false;
                    case 7:
                        switch (str) {
                        case "default":
                        case "finally":
                            return true
                        }
                        return false;
                    case 10:
                        return str === "instanceof";
                    }
                },
                6: function anonymous(str) {
                    switch (str.length) {
                    case 5:
                        switch (str) {
                        case "break":
                        case "catch":
                        case "throw":
                        case "while":
                        case "false":
                        case "const":
                        case "class":
                        case "yield":
                        case "super":
                            return true
                        }
                        return false;
                    case 4:
                        switch (str) {
                        case "case":
                        case "else":
                        case "with":
                        case "null":
                        case "true":
                        case "void":
                        case "this":
                            return true
                        }
                        return false;
                    case 6:
                        switch (str) {
                        case "return":
                        case "switch":
                        case "typeof":
                        case "delete":
                        case "export":
                        case "import":
                            return true
                        }
                        return false;
                    case 3:
                        switch (str) {
                        case "for":
                        case "try":
                        case "var":
                        case "new":
                        case "let":
                            return true
                        }
                        return false;
                    case 8:
                        switch (str) {
                        case "continue":
                        case "debugger":
                        case "function":
                            return true
                        }
                        return false;
                    case 7:
                        switch (str) {
                        case "default":
                        case "finally":
                        case "extends":
                            return true
                        }
                        return false;
                    case 2:
                        switch (str) {
                        case "do":
                        case "if":
                        case "in":
                            return true
                        }
                        return false;
                    case 10:
                        return str === "instanceof";
                    }
                }
            };

            exports.keywords = keywords;
            // ## Character categories

            // Big ugly regular expressions that match characters in the
            // whitespace, identifier, and identifier-start categories. These
            // are only applied when a character is found to actually have a
            // code point above 128.
            // Generated by `tools/generate-identifier-regex.js`.

            /* CHRIS: Disabling this - invalid regex error thrown
            var nonASCIIidentifierStartChars = "ªµºÀ-ÖØ-öø-ˁˆ-ˑˠ-ˤˬˮͰ-ʹͶͷͺ-ͽͿΆΈ-ΊΌΎ-ΡΣ-ϵϷ-ҁҊ-ԯԱ-Ֆՙա-ևא-תװ-ײؠ-يٮٯٱ-ۓەۥۦۮۯۺ-ۼۿܐܒ-ܯݍ-ޥޱߊ-ߪߴߵߺࠀ-ࠕࠚࠤࠨࡀ-ࡘࢠ-ࢲऄ-हऽॐक़-ॡॱ-ঀঅ-ঌএঐও-নপ-রলশ-হঽৎড়ঢ়য়-ৡৰৱਅ-ਊਏਐਓ-ਨਪ-ਰਲਲ਼ਵਸ਼ਸਹਖ਼-ੜਫ਼ੲ-ੴઅ-ઍએ-ઑઓ-નપ-રલળવ-હઽૐૠૡଅ-ଌଏଐଓ-ନପ-ରଲଳଵ-ହଽଡ଼ଢ଼ୟ-ୡୱஃஅ-ஊஎ-ஐஒ-கஙசஜஞடணதந-பம-ஹௐఅ-ఌఎ-ఐఒ-నప-హఽౘౙౠౡಅ-ಌಎ-ಐಒ-ನಪ-ಳವ-ಹಽೞೠೡೱೲഅ-ഌഎ-ഐഒ-ഺഽൎൠൡൺ-ൿඅ-ඖක-නඳ-රලව-ෆก-ะาำเ-ๆກຂຄງຈຊຍດ-ທນ-ຟມ-ຣລວສຫອ-ະາຳຽເ-ໄໆໜ-ໟༀཀ-ཇཉ-ཬྈ-ྌက-ဪဿၐ-ၕၚ-ၝၡၥၦၮ-ၰၵ-ႁႎႠ-ჅჇჍა-ჺჼ-ቈቊ-ቍቐ-ቖቘቚ-ቝበ-ኈኊ-ኍነ-ኰኲ-ኵኸ-ኾዀዂ-ዅወ-ዖዘ-ጐጒ-ጕጘ-ፚᎀ-ᎏᎠ-Ᏼᐁ-ᙬᙯ-ᙿᚁ-ᚚᚠ-ᛪᛮ-ᛸᜀ-ᜌᜎ-ᜑᜠ-ᜱᝀ-ᝑᝠ-ᝬᝮ-ᝰក-ឳៗៜᠠ-ᡷᢀ-ᢨᢪᢰ-ᣵᤀ-ᤞᥐ-ᥭᥰ-ᥴᦀ-ᦫᧁ-ᧇᨀ-ᨖᨠ-ᩔᪧᬅ-ᬳᭅ-ᭋᮃ-ᮠᮮᮯᮺ-ᯥᰀ-ᰣᱍ-ᱏᱚ-ᱽᳩ-ᳬᳮ-ᳱᳵᳶᴀ-ᶿḀ-ἕἘ-Ἕἠ-ὅὈ-Ὅὐ-ὗὙὛὝὟ-ώᾀ-ᾴᾶ-ᾼιῂ-ῄῆ-ῌῐ-ΐῖ-Ίῠ-Ῥῲ-ῴῶ-ῼⁱⁿₐ-ₜℂℇℊ-ℓℕ℘-ℝℤΩℨK-ℹℼ-ℿⅅ-ⅉⅎⅠ-ↈⰀ-Ⱞⰰ-ⱞⱠ-ⳤⳫ-ⳮⳲⳳⴀ-ⴥⴧⴭⴰ-ⵧⵯⶀ-ⶖⶠ-ⶦⶨ-ⶮⶰ-ⶶⶸ-ⶾⷀ-ⷆⷈ-ⷎⷐ-ⷖⷘ-ⷞ々-〇〡-〩〱-〵〸-〼ぁ-ゖ゛-ゟァ-ヺー-ヿㄅ-ㄭㄱ-ㆎㆠ-ㆺㇰ-ㇿ㐀-䶵一-鿌ꀀ-ꒌꓐ-ꓽꔀ-ꘌꘐ-ꘟꘪꘫꙀ-ꙮꙿ-ꚝꚠ-ꛯꜗ-ꜟꜢ-ꞈꞋ-ꞎꞐ-ꞭꞰꞱꟷ-ꠁꠃ-ꠅꠇ-ꠊꠌ-ꠢꡀ-ꡳꢂ-ꢳꣲ-ꣷꣻꤊ-ꤥꤰ-ꥆꥠ-ꥼꦄ-ꦲꧏꧠ-ꧤꧦ-ꧯꧺ-ꧾꨀ-ꨨꩀ-ꩂꩄ-ꩋꩠ-ꩶꩺꩾ-ꪯꪱꪵꪶꪹ-ꪽꫀꫂꫛ-ꫝꫠ-ꫪꫲ-ꫴꬁ-ꬆꬉ-ꬎꬑ-ꬖꬠ-ꬦꬨ-ꬮꬰ-ꭚꭜ-ꭟꭤꭥꯀ-ꯢ가-힣ힰ-ퟆퟋ-ퟻ豈-舘並-龎ﬀ-ﬆﬓ-ﬗיִײַ-ﬨשׁ-זּטּ-לּמּנּסּףּפּצּ-ﮱﯓ-ﴽﵐ-ﶏﶒ-ﷇﷰ-ﷻﹰ-ﹴﹶ-ﻼＡ-Ｚａ-ｚｦ-ﾾￂ-ￇￊ-ￏￒ-ￗￚ-ￜ";
            var nonASCIIidentifierChars = "‌‍·̀-ͯ·҃-֑҇-ׇֽֿׁׂׅׄؐ-ًؚ-٩ٰۖ-ۜ۟-۪ۤۧۨ-ۭ۰-۹ܑܰ-݊ަ-ް߀-߉߫-߳ࠖ-࠙ࠛ-ࠣࠥ-ࠧࠩ-࡙࠭-࡛ࣤ-ःऺ-़ा-ॏ॑-ॗॢॣ०-९ঁ-ঃ়া-ৄেৈো-্ৗৢৣ০-৯ਁ-ਃ਼ਾ-ੂੇੈੋ-੍ੑ੦-ੱੵઁ-ઃ઼ા-ૅે-ૉો-્ૢૣ૦-૯ଁ-ଃ଼ା-ୄେୈୋ-୍ୖୗୢୣ୦-୯ஂா-ூெ-ைொ-்ௗ௦-௯ఀ-ఃా-ౄె-ైొ-్ౕౖౢౣ౦-౯ಁ-ಃ಼ಾ-ೄೆ-ೈೊ-್ೕೖೢೣ೦-೯ഁ-ഃാ-ൄെ-ൈൊ-്ൗൢൣ൦-൯ංඃ්ා-ුූෘ-ෟ෦-෯ෲෳัิ-ฺ็-๎๐-๙ັິ-ູົຼ່-ໍ໐-໙༘༙༠-༩༹༵༷༾༿ཱ-྄྆྇ྍ-ྗྙ-ྼ࿆ါ-ှ၀-၉ၖ-ၙၞ-ၠၢ-ၤၧ-ၭၱ-ၴႂ-ႍႏ-ႝ፝-፟፩-፱ᜒ-᜔ᜲ-᜴ᝒᝓᝲᝳ឴-៓៝០-៩᠋-᠍᠐-᠙ᢩᤠ-ᤫᤰ-᤻᥆-᥏ᦰ-ᧀᧈᧉ᧐-᧚ᨗ-ᨛᩕ-ᩞ᩠-᩿᩼-᪉᪐-᪙᪰-᪽ᬀ-ᬄ᬴-᭄᭐-᭙᭫-᭳ᮀ-ᮂᮡ-ᮭ᮰-᮹᯦-᯳ᰤ-᰷᱀-᱉᱐-᱙᳐-᳔᳒-᳨᳭ᳲ-᳴᳸᳹᷀-᷵᷼-᷿‿⁀⁔⃐-⃥⃜⃡-⃰⳯-⵿⳱ⷠ-〪ⷿ-゙゚〯꘠-꘩꙯ꙴ-꙽ꚟ꛰꛱ꠂ꠆ꠋꠣ-ꠧꢀꢁꢴ-꣄꣐-꣙꣠-꣱꤀-꤉ꤦ-꤭ꥇ-꥓ꦀ-ꦃ꦳-꧀꧐-꧙ꧥ꧰-꧹ꨩ-ꨶꩃꩌꩍ꩐-꩙ꩻ-ꩽꪰꪲ-ꪴꪷꪸꪾ꪿꫁ꫫ-ꫯꫵ꫶ꯣ-ꯪ꯬꯭꯰-꯹ﬞ︀-️︠-︭︳︴﹍-﹏０-９＿";

            var nonASCIIidentifierStart = new RegExp("[" + nonASCIIidentifierStartChars + "]");
            var nonASCIIidentifier = new RegExp("[" + nonASCIIidentifierStartChars + nonASCIIidentifierChars + "]");

            nonASCIIidentifierStartChars = nonASCIIidentifierChars = null;
            */

            // These are a run-length and offset encoded representation of the
            // >0xffff code points that are a valid part of identifiers. The
            // offset starts at 0x10000, and each pair of numbers represents an
            // offset to the next range, and then a size of the range. They were
            // generated by tools/generate-identifier-regex.js
            var astralIdentifierStartCodes = [0, 11, 2, 25, 2, 18, 2, 1, 2, 14, 3, 13, 35, 122, 70, 52, 268, 28, 4, 48, 48, 31, 17, 26, 6, 37, 11, 29, 3, 35, 5, 7, 2, 4, 43, 157, 99, 39, 9, 51, 157, 310, 10, 21, 11, 7, 153, 5, 3, 0, 2, 43, 2, 1, 4, 0, 3, 22, 11, 22, 10, 30, 98, 21, 11, 25, 71, 55, 7, 1, 65, 0, 16, 3, 2, 2, 2, 26, 45, 28, 4, 28, 36, 7, 2, 27, 28, 53, 11, 21, 11, 18, 14, 17, 111, 72, 955, 52, 76, 44, 33, 24, 27, 35, 42, 34, 4, 0, 13, 47, 15, 3, 22, 0, 38, 17, 2, 24, 133, 46, 39, 7, 3, 1, 3, 21, 2, 6, 2, 1, 2, 4, 4, 0, 32, 4, 287, 47, 21, 1, 2, 0, 185, 46, 82, 47, 21, 0, 60, 42, 502, 63, 32, 0, 449, 56, 1288, 920, 104, 110, 2962, 1070, 13266, 568, 8, 30, 114, 29, 19, 47, 17, 3, 32, 20, 6, 18, 881, 68, 12, 0, 67, 12, 16481, 1, 3071, 106, 6, 12, 4, 8, 8, 9, 5991, 84, 2, 70, 2, 1, 3, 0, 3, 1, 3, 3, 2, 11, 2, 0, 2, 6, 2, 64, 2, 3, 3, 7, 2, 6, 2, 27, 2, 3, 2, 4, 2, 0, 4, 6, 2, 339, 3, 24, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 7, 4149, 196, 1340, 3, 2, 26, 2, 1, 2, 0, 3, 0, 2, 9, 2, 3, 2, 0, 2, 0, 7, 0, 5, 0, 2, 0, 2, 0, 2, 2, 2, 1, 2, 0, 3, 0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 1, 2, 0, 3, 3, 2, 6, 2, 3, 2, 3, 2, 0, 2, 9, 2, 16, 6, 2, 2, 4, 2, 16, 4421, 42710, 42, 4148, 12, 221, 16355, 541];
            var astralIdentifierCodes = [509, 0, 227, 0, 150, 4, 294, 9, 1368, 2, 2, 1, 6, 3, 41, 2, 5, 0, 166, 1, 1306, 2, 54, 14, 32, 9, 16, 3, 46, 10, 54, 9, 7, 2, 37, 13, 2, 9, 52, 0, 13, 2, 49, 13, 16, 9, 83, 11, 168, 11, 6, 9, 8, 2, 57, 0, 2, 6, 3, 1, 3, 2, 10, 0, 11, 1, 3, 6, 4, 4, 316, 19, 13, 9, 214, 6, 3, 8, 112, 16, 16, 9, 82, 12, 9, 9, 535, 9, 20855, 9, 135, 4, 60, 6, 26, 9, 1016, 45, 17, 3, 19723, 1, 5319, 4, 4, 5, 9, 7, 3, 6, 31, 3, 149, 2, 1418, 49, 4305, 6, 792618, 239];

            // This has a complexity linear to the value of the code. The
            // assumption is that looking up astral identifier characters is
            // rare.
            function isInAstralSet(code, set) {
                var pos = 65536;
                for (var i = 0; i < set.length; i += 2) {
                    pos += set[i];
                    if (pos > code) {
                        return false;
                    }
                    pos += set[i + 1];
                    if (pos >= code) {
                        return true;
                    }
                }
            }

            function isIdentifierStart(code, astral) {
                if (code < 65) {
                    return code === 36;
                }
                if (code < 91) {
                    return true;
                }
                if (code < 97) {
                    return code === 95;
                }
                if (code < 123) {
                    return true;
                }
                /* CHRIS: Disabling this - invalid regex error thrown
                if (code <= 65535) {
                    return code >= 170 && nonASCIIidentifierStart.test(String.fromCharCode(code));
                }
                */
                if (astral === false) {
                    return false;
                }
                return isInAstralSet(code, astralIdentifierStartCodes);
            }

            function isIdentifierChar(code, astral) {
                if (code < 48) {
                    return code === 36;
                }
                if (code < 58) {
                    return true;
                }
                if (code < 65) {
                    return false;
                }
                if (code < 91) {
                    return true;
                }
                if (code < 97) {
                    return code === 95;
                }
                if (code < 123) {
                    return true;
                }
                /* CHRIS: Disabling this - invalid regex error thrown
                if (code <= 65535) {
                    return code >= 170 && nonASCIIidentifier.test(String.fromCharCode(code));
                }
                */
                if (astral === false) {
                    return false;
                }
                return isInAstralSet(code, astralIdentifierStartCodes) || isInAstralSet(code, astralIdentifierCodes);
            }

        }, {}],
        4: [function(_dereq_, module, exports) {
            "use strict";

            var _createClass = (function() {
                function defineProperties(target, props) {
                    for (var key in props) {
                        var prop = props[key];
                        prop.configurable = true;
                        if (prop.value) prop.writable = true;
                    }
                    Object.defineProperties(target, props);
                }
                return function(Constructor, protoProps, staticProps) {
                    if (protoProps) defineProperties(Constructor.prototype, protoProps);
                    if (staticProps) defineProperties(Constructor, staticProps);
                    return Constructor;
                };
            })();

            var _classCallCheck = function(instance, Constructor) {
                if (!(instance instanceof Constructor)) {
                    throw new TypeError("Cannot call a class as a function");
                }
            };

            // The `getLineInfo` function is mostly useful when the
            // `locations` option is off (for performance reasons) and you
            // want to find the line/column position for a given character
            // offset. `input` should be the code string that the offset refers
            // into.

            exports.getLineInfo = getLineInfo;
            Object.defineProperty(exports, "__esModule", {
                value: true
            });

            var Parser = _dereq_("./state").Parser;

            var lineBreakG = _dereq_("./whitespace").lineBreakG;

            // These are used when `options.locations` is on, for the
            // `startLoc` and `endLoc` properties.

            var Position = exports.Position = (function() {
                function Position(line, col) {
                    _classCallCheck(this, Position);

                    this.line = line;
                    this.column = col;
                }

                _createClass(Position, {
                    offset: {
                        value: function offset(n) {
                            return new Position(this.line, this.column + n);
                        }
                    }
                });

                return Position;
            })();

            var SourceLocation = exports.SourceLocation = function SourceLocation(p, start, end) {
                _classCallCheck(this, SourceLocation);

                this.start = start;
                this.end = end;
                if (p.sourceFile !== null) this.source = p.sourceFile;
            };

            function getLineInfo(input, offset) {
                for (var line = 1, cur = 0;;) {
                    lineBreakG.lastIndex = cur;
                    var match = lineBreakG.exec(input);
                    if (match && match.index < offset) {
                        ++line;
                        cur = match.index + match[0].length;
                    }
                    else {
                        return new Position(line, offset - cur);
                    }
                }
            }

            var pp = Parser.prototype;

            // This function is used to raise exceptions on parse errors. It
            // takes an offset integer (into the current `input`) to indicate
            // the location of the error, attaches the position to the end
            // of the error message, and then raises a `SyntaxError` with that
            // message.

            pp.raise = function(pos, message) {
                var loc = getLineInfo(this.input, pos);
                message += " (" + loc.line + ":" + loc.column + ")";
                var err = new SyntaxError(message);
                err.pos = pos;
                err.loc = loc;
                err.raisedAt = this.pos;
                throw err;
            };

            pp.curPosition = function() {
                return new Position(this.curLine, this.pos - this.lineStart);
            };

            pp.markPosition = function() {
                return this.options.locations ? [this.start, this.startLoc] : this.start;
            };

        }, {
            "./state": 9,
            "./whitespace": 15
        }],
        5: [function(_dereq_, module, exports) {
            "use strict";

            var tt = _dereq_("./tokentype").types;

            var Parser = _dereq_("./state").Parser;

            var reservedWords = _dereq_("./identifier").reservedWords;

            var has = _dereq_("./util").has;

            var pp = Parser.prototype;

            // Convert existing expression atom to assignable pattern
            // if possible.

            pp.toAssignable = function(node, isBinding) {
                if (this.options.ecmaVersion >= 6 && node) {
                    switch (node.type) {
                    case "Identifier":
                    case "ObjectPattern":
                    case "ArrayPattern":
                    case "AssignmentPattern":
                        break;

                    case "ObjectExpression":
                        node.type = "ObjectPattern";
                        for (var i = 0; i < node.properties.length; i++) {
                            var prop = node.properties[i];
                            if (prop.kind !== "init") this.raise(prop.key.start, "Object pattern can't contain getter or setter");
                            this.toAssignable(prop.value, isBinding);
                        }
                        break;

                    case "ArrayExpression":
                        node.type = "ArrayPattern";
                        this.toAssignableList(node.elements, isBinding);
                        break;

                    case "AssignmentExpression":
                        if (node.operator === "=") {
                            node.type = "AssignmentPattern";
                        }
                        else {
                            this.raise(node.left.end, "Only '=' operator can be used for specifying default value.");
                        }
                        break;

                    case "MemberExpression":
                        if (!isBinding) break;

                    default:
                        this.raise(node.start, "Assigning to rvalue");
                    }
                }
                return node;
            };

            // Convert list of expression atoms to binding list.

            pp.toAssignableList = function(exprList, isBinding) {
                var end = exprList.length;
                if (end) {
                    var last = exprList[end - 1];
                    if (last && last.type == "RestElement") {
                        --end;
                    }
                    else if (last && last.type == "SpreadElement") {
                        last.type = "RestElement";
                        var arg = last.argument;
                        this.toAssignable(arg, isBinding);
                        if (arg.type !== "Identifier" && arg.type !== "MemberExpression" && arg.type !== "ArrayPattern") this.unexpected(arg.start);
                        --end;
                    }
                }
                for (var i = 0; i < end; i++) {
                    var elt = exprList[i];
                    if (elt) this.toAssignable(elt, isBinding);
                }
                return exprList;
            };

            // Parses spread element.

            pp.parseSpread = function(refShorthandDefaultPos) {
                var node = this.startNode();
                this.next();
                node.argument = this.parseMaybeAssign(refShorthandDefaultPos);
                return this.finishNode(node, "SpreadElement");
            };

            pp.parseRest = function() {
                var node = this.startNode();
                this.next();
                node.argument = this.type === tt.name || this.type === tt.bracketL ? this.parseBindingAtom() : this.unexpected();
                return this.finishNode(node, "RestElement");
            };

            // Parses lvalue (assignable) atom.

            pp.parseBindingAtom = function() {
                if (this.options.ecmaVersion < 6) return this.parseIdent();
                switch (this.type) {
                case tt.name:
                    return this.parseIdent();

                case tt.bracketL:
                    var node = this.startNode();
                    this.next();
                    node.elements = this.parseBindingList(tt.bracketR, true, true);
                    return this.finishNode(node, "ArrayPattern");

                case tt.braceL:
                    return this.parseObj(true);

                default:
                    this.unexpected();
                }
            };

            pp.parseBindingList = function(close, allowEmpty, allowTrailingComma) {
                var elts = [],
                    first = true;
                while (!this.eat(close)) {
                    if (first) first = false;
                    else this.expect(tt.comma);
                    if (allowEmpty && this.type === tt.comma) {
                        elts.push(null);
                    }
                    else if (allowTrailingComma && this.afterTrailingComma(close)) {
                        break;
                    }
                    else if (this.type === tt.ellipsis) {
                        elts.push(this.parseRest());
                        this.expect(close);
                        break;
                    }
                    else {
                        elts.push(this.parseMaybeDefault());
                    }
                }
                return elts;
            };

            // Parses assignment pattern around given atom if possible.

            pp.parseMaybeDefault = function(startPos, left) {
                startPos = startPos || this.markPosition();
                left = left || this.parseBindingAtom();
                if (!this.eat(tt.eq)) return left;
                var node = this.startNodeAt(startPos);
                node.operator = "=";
                node.left = left;
                node.right = this.parseMaybeAssign();
                return this.finishNode(node, "AssignmentPattern");
            };

            // Verify that a node is an lval — something that can be assigned
            // to.

            pp.checkLVal = function(expr, isBinding, checkClashes) {
                switch (expr.type) {
                case "Identifier":
                    if (this.strict && (reservedWords.strictBind(expr.name) || reservedWords.strict(expr.name))) this.raise(expr.start, (isBinding ? "Binding " : "Assigning to ") + expr.name + " in strict mode");
                    if (checkClashes) {
                        if (has(checkClashes, expr.name)) this.raise(expr.start, "Argument name clash in strict mode");
                        checkClashes[expr.name] = true;
                    }
                    break;

                case "MemberExpression":
                    if (isBinding) this.raise(expr.start, (isBinding ? "Binding" : "Assigning to") + " member expression");
                    break;

                case "ObjectPattern":
                    for (var i = 0; i < expr.properties.length; i++) {
                        this.checkLVal(expr.properties[i].value, isBinding, checkClashes);
                    }
                    break;

                case "ArrayPattern":
                    for (var i = 0; i < expr.elements.length; i++) {
                        var elem = expr.elements[i];
                        if (elem) this.checkLVal(elem, isBinding, checkClashes);
                    }
                    break;

                case "AssignmentPattern":
                    this.checkLVal(expr.left, isBinding, checkClashes);
                    break;

                case "RestElement":
                    this.checkLVal(expr.argument, isBinding, checkClashes);
                    break;

                default:
                    this.raise(expr.start, (isBinding ? "Binding" : "Assigning to") + " rvalue");
                }
            };

        }, {
            "./identifier": 3,
            "./state": 9,
            "./tokentype": 13,
            "./util": 14
        }],
        6: [function(_dereq_, module, exports) {
            "use strict";

            var _classCallCheck = function(instance, Constructor) {
                if (!(instance instanceof Constructor)) {
                    throw new TypeError("Cannot call a class as a function");
                }
            };

            Object.defineProperty(exports, "__esModule", {
                value: true
            });

            var Parser = _dereq_("./state").Parser;

            var SourceLocation = _dereq_("./location").SourceLocation;

            // Start an AST node, attaching a start offset.

            var pp = Parser.prototype;

            var Node = exports.Node = function Node() {
                _classCallCheck(this, Node);
            };

            pp.startNode = function() {
                var node = new Node();
                node.start = this.start;
                if (this.options.locations) node.loc = new SourceLocation(this, this.startLoc);
                if (this.options.directSourceFile) node.sourceFile = this.options.directSourceFile;
                if (this.options.ranges) node.range = [this.start, 0];
                return node;
            };

            pp.startNodeAt = function(pos) {
                var node = new Node(),
                    start = pos;
                if (this.options.locations) {
                    node.loc = new SourceLocation(this, start[1]);
                    start = pos[0];
                }
                node.start = start;
                if (this.options.directSourceFile) node.sourceFile = this.options.directSourceFile;
                if (this.options.ranges) node.range = [start, 0];
                return node;
            };

            // Finish an AST node, adding `type` and `end` properties.

            pp.finishNode = function(node, type) {
                node.type = type;
                node.end = this.lastTokEnd;
                if (this.options.locations) node.loc.end = this.lastTokEndLoc;
                if (this.options.ranges) node.range[1] = this.lastTokEnd;
                return node;
            };

            // Finish node at given position

            pp.finishNodeAt = function(node, type, pos) {
                if (this.options.locations) {
                    node.loc.end = pos[1];
                    pos = pos[0];
                }
                node.type = type;
                node.end = pos;
                if (this.options.ranges) node.range[1] = pos;
                return node;
            };

        }, {
            "./location": 4,
            "./state": 9
        }],
        7: [function(_dereq_, module, exports) {


            // Interpret and default an options object

            "use strict";

            exports.getOptions = getOptions;
            Object.defineProperty(exports, "__esModule", {
                value: true
            });

            var _util = _dereq_("./util");

            var has = _util.has;
            var isArray = _util.isArray;

            var SourceLocation = _dereq_("./location").SourceLocation;

            // A second optional argument can be given to further configure
            // the parser process. These options are recognized:

            var defaultOptions = {
                // `ecmaVersion` indicates the ECMAScript version to parse. Must
                // be either 3, or 5, or 6. This influences support for strict
                // mode, the set of reserved words, support for getters and
                // setters and other features.
                ecmaVersion: 5,
                // Source type ("script" or "module") for different semantics
                sourceType: "script",
                // `onInsertedSemicolon` can be a callback that will be called
                // when a semicolon is automatically inserted. It will be passed
                // th position of the comma as an offset, and if `locations` is
                // enabled, it is given the location as a `{line, column}` object
                // as second argument.
                onInsertedSemicolon: null,
                // `onTrailingComma` is similar to `onInsertedSemicolon`, but for
                // trailing commas.
                onTrailingComma: null,
                // By default, reserved words are not enforced. Disable
                // `allowReserved` to enforce them. When this option has the
                // value "never", reserved words and keywords can also not be
                // used as property names.
                allowReserved: true,
                // When enabled, a return at the top level is not considered an
                // error.
                allowReturnOutsideFunction: false,
                // When enabled, import/export statements are not constrained to
                // appearing at the top of the program.
                allowImportExportEverywhere: false,
                // When enabled, hashbang directive in the beginning of file
                // is allowed and treated as a line comment.
                allowHashBang: false,
                // When `locations` is on, `loc` properties holding objects with
                // `start` and `end` properties in `{line, column}` form (with
                // line being 1-based and column 0-based) will be attached to the
                // nodes.
                locations: false,
                // A function can be passed as `onToken` option, which will
                // cause Acorn to call that function with object in the same
                // format as tokenize() returns. Note that you are not
                // allowed to call the parser from the callback—that will
                // corrupt its internal state.
                onToken: null,
                // A function can be passed as `onComment` option, which will
                // cause Acorn to call that function with `(block, text, start,
                // end)` parameters whenever a comment is skipped. `block` is a
                // boolean indicating whether this is a block (`/* */`) comment,
                // `text` is the content of the comment, and `start` and `end` are
                // character offsets that denote the start and end of the comment.
                // When the `locations` option is on, two more parameters are
                // passed, the full `{line, column}` locations of the start and
                // end of the comments. Note that you are not allowed to call the
                // parser from the callback—that will corrupt its internal state.
                onComment: null,
                // Nodes have their start and end characters offsets recorded in
                // `start` and `end` properties (directly on the node, rather than
                // the `loc` object, which holds line/column data. To also add a
                // [semi-standardized][range] `range` property holding a `[start,
                // end]` array with the same numbers, set the `ranges` option to
                // `true`.
                //
                // [range]: https://bugzilla.mozilla.org/show_bug.cgi?id=745678
                ranges: false,
                // It is possible to parse multiple files into a single AST by
                // passing the tree produced by parsing the first file as
                // `program` option in subsequent parses. This will add the
                // toplevel forms of the parsed file to the `Program` (top) node
                // of an existing parse tree.
                program: null,
                // When `locations` is on, you can pass this to record the source
                // file in every node's `loc` object.
                sourceFile: null,
                // This value, if given, is stored in every node, whether
                // `locations` is on or off.
                directSourceFile: null,
                // When enabled, parenthesized expressions are represented by
                // (non-standard) ParenthesizedExpression nodes
                preserveParens: false,
                plugins: {}
            };
            exports.defaultOptions = defaultOptions;

            function getOptions(opts) {
                var options = {};
                for (var opt in defaultOptions) {
                    options[opt] = opts && has(opts, opt) ? opts[opt] : defaultOptions[opt];
                }
                if (isArray(options.onToken)) {
                    (function() {
                        var tokens = options.onToken;
                        options.onToken = function(token) {
                            return tokens.push(token);
                        };
                    })();
                }
                if (isArray(options.onComment)) options.onComment = pushComment(options, options.onComment);

                return options;
            }

            function pushComment(options, array) {
                return function(block, text, start, end, startLoc, endLoc) {
                    var comment = {
                        type: block ? "Block" : "Line",
                        value: text,
                        start: start,
                        end: end
                    };
                    if (options.locations) comment.loc = new SourceLocation(this, startLoc, endLoc);
                    if (options.ranges) comment.range = [start, end];
                    array.push(comment);
                };
            }

        }, {
            "./location": 4,
            "./util": 14
        }],
        8: [function(_dereq_, module, exports) {
            "use strict";

            var tt = _dereq_("./tokentype").types;

            var Parser = _dereq_("./state").Parser;

            var lineBreak = _dereq_("./whitespace").lineBreak;

            var pp = Parser.prototype;

            // ## Parser utilities

            // Test whether a statement node is the string literal `"use strict"`.

            pp.isUseStrict = function(stmt) {
                return this.options.ecmaVersion >= 5 && stmt.type === "ExpressionStatement" && stmt.expression.type === "Literal" && stmt.expression.value === "use strict";
            };

            // Predicate that tests whether the next token is of the given
            // type, and if yes, consumes it as a side effect.

            pp.eat = function(type) {
                if (this.type === type) {
                    this.next();
                    return true;
                }
                else {
                    return false;
                }
            };

            // Tests whether parsed token is a contextual keyword.

            pp.isContextual = function(name) {
                return this.type === tt.name && this.value === name;
            };

            // Consumes contextual keyword if possible.

            pp.eatContextual = function(name) {
                return this.value === name && this.eat(tt.name);
            };

            // Asserts that following token is given contextual keyword.

            pp.expectContextual = function(name) {
                if (!this.eatContextual(name)) this.unexpected();
            };

            // Test whether a semicolon can be inserted at the current position.

            pp.canInsertSemicolon = function() {
                return this.type === tt.eof || this.type === tt.braceR || lineBreak.test(this.input.slice(this.lastTokEnd, this.start));
            };

            pp.insertSemicolon = function() {
                if (this.canInsertSemicolon()) {
                    if (this.options.onInsertedSemicolon) this.options.onInsertedSemicolon(this.lastTokEnd, this.lastTokEndLoc);
                    return true;
                }
            };

            // Consume a semicolon, or, failing that, see if we are allowed to
            // pretend that there is a semicolon at this position.

            pp.semicolon = function() {
                if (!this.eat(tt.semi) && !this.insertSemicolon()) this.unexpected();
            };

            pp.afterTrailingComma = function(tokType) {
                if (this.type == tokType) {
                    if (this.options.onTrailingComma) this.options.onTrailingComma(this.lastTokStart, this.lastTokStartLoc);
                    this.next();
                    return true;
                }
            };

            // Expect a token of a given type. If found, consume it, otherwise,
            // raise an unexpected token error.

            pp.expect = function(type) {
                this.eat(type) || this.unexpected();
            };

            // Raise an unexpected token error.

            pp.unexpected = function(pos) {
                this.raise(pos != null ? pos : this.start, "Unexpected token");
            };

        }, {
            "./state": 9,
            "./tokentype": 13,
            "./whitespace": 15
        }],
        9: [function(_dereq_, module, exports) {
            "use strict";

            exports.Parser = Parser;
            Object.defineProperty(exports, "__esModule", {
                value: true
            });

            var _identifier = _dereq_("./identifier");

            var reservedWords = _identifier.reservedWords;
            var keywords = _identifier.keywords;

            var _tokentype = _dereq_("./tokentype");

            var tt = _tokentype.types;
            var lineBreak = _tokentype.lineBreak;

            function Parser(options, input, startPos) {
                this.options = options;
                this.loadPlugins(this.options.plugins);
                this.sourceFile = this.options.sourceFile || null;
                this.isKeyword = keywords[this.options.ecmaVersion >= 6 ? 6 : 5];
                this.isReservedWord = reservedWords[this.options.ecmaVersion];
                this.input = input;

                // Set up token state

                // The current position of the tokenizer in the input.
                if (startPos) {
                    this.pos = startPos;
                    this.lineStart = Math.max(0, this.input.lastIndexOf("\n", startPos));
                    this.curLine = this.input.slice(0, this.lineStart).split(lineBreak).length;
                }
                else {
                    this.pos = this.lineStart = 0;
                    this.curLine = 1;
                }

                // Properties of the current token:
                // Its type
                this.type = tt.eof;
                // For tokens that include more information than their type, the value
                this.value = null;
                // Its start and end offset
                this.start = this.end = this.pos;
                // And, if locations are used, the {line, column} object
                // corresponding to those offsets
                this.startLoc = this.endLoc = null;

                // Position information for the previous token
                this.lastTokEndLoc = this.lastTokStartLoc = null;
                this.lastTokStart = this.lastTokEnd = this.pos;

                // The context stack is used to superficially track syntactic
                // context to predict whether a regular expression is allowed in a
                // given position.
                this.context = this.initialContext();
                this.exprAllowed = true;

                // Figure out if it's a module code.
                this.strict = this.inModule = this.options.sourceType === "module";

                // Flags to track whether we are in a function, a generator.
                this.inFunction = this.inGenerator = false;
                // Labels in scope.
                this.labels = [];

                // If enabled, skip leading hashbang line.
                if (this.pos === 0 && this.options.allowHashBang && this.input.slice(0, 2) === "#!") this.skipLineComment(2);
            }

            Parser.prototype.extend = function(name, f) {
                this[name] = f(this[name]);
            };

            // Registered plugins

            var plugins = {};

            exports.plugins = plugins;
            Parser.prototype.loadPlugins = function(plugins) {
                for (var _name in plugins) {
                    var plugin = exports.plugins[_name];
                    if (!plugin) throw new Error("Plugin '" + _name + "' not found");
                    plugin(this, plugins[_name]);
                }
            };

        }, {
            "./identifier": 3,
            "./tokentype": 13
        }],
        10: [function(_dereq_, module, exports) {
            "use strict";

            var tt = _dereq_("./tokentype").types;

            var Parser = _dereq_("./state").Parser;

            var lineBreak = _dereq_("./whitespace").lineBreak;

            var pp = Parser.prototype;

            // ### Statement parsing

            // Parse a program. Initializes the parser, reads any number of
            // statements, and wraps them in a Program node.  Optionally takes a
            // `program` argument.  If present, the statements will be appended
            // to its body instead of creating a new node.

            pp.parseTopLevel = function(node) {
                var first = true;
                if (!node.body) node.body = [];
                while (this.type !== tt.eof) {
                    var stmt = this.parseStatement(true, true);
                    node.body.push(stmt);
                    if (first && this.isUseStrict(stmt)) this.setStrict(true);
                    first = false;
                }
                this.next();
                if (this.options.ecmaVersion >= 6) {
                    node.sourceType = this.options.sourceType;
                }
                return this.finishNode(node, "Program");
            };

            var loopLabel = {
                kind: "loop"
            },
            switchLabel = {
                kind: "switch"
            };

            // Parse a single statement.
            //
            // If expecting a statement and finding a slash operator, parse a
            // regular expression literal. This is to handle cases like
            // `if (foo) /blah/.exec(foo)`, where looking at the previous token
            // does not help.

            pp.parseStatement = function(declaration, topLevel) {
                var starttype = this.type,
                    node = this.startNode();

                // Most types of statements are recognized by the keyword they
                // start with. Many are trivial to parse, some require a bit of
                // complexity.

                switch (starttype) {
                case tt._break:
                case tt._continue:
                    return this.parseBreakContinueStatement(node, starttype.keyword);
                case tt._debugger:
                    return this.parseDebuggerStatement(node);
                case tt._do:
                    return this.parseDoStatement(node);
                case tt._for:
                    return this.parseForStatement(node);
                case tt._function:
                    if (!declaration && this.options.ecmaVersion >= 6) this.unexpected();
                    return this.parseFunctionStatement(node);
                case tt._class:
                    if (!declaration) this.unexpected();
                    return this.parseClass(node, true);
                case tt._if:
                    return this.parseIfStatement(node);
                case tt._return:
                    return this.parseReturnStatement(node);
                case tt._switch:
                    return this.parseSwitchStatement(node);
                case tt._throw:
                    return this.parseThrowStatement(node);
                case tt._try:
                    return this.parseTryStatement(node);
                case tt._let:
                case tt._const:
                    if (!declaration) this.unexpected(); // NOTE: falls through to _var
                case tt._var:
                    return this.parseVarStatement(node, starttype);
                case tt._while:
                    return this.parseWhileStatement(node);
                case tt._with:
                    return this.parseWithStatement(node);
                case tt.braceL:
                    return this.parseBlock();
                case tt.semi:
                    return this.parseEmptyStatement(node);
                case tt._export:
                case tt._import:
                    if (!this.options.allowImportExportEverywhere) {
                        if (!topLevel) this.raise(this.start, "'import' and 'export' may only appear at the top level");
                        if (!this.inModule) this.raise(this.start, "'import' and 'export' may appear only with 'sourceType: module'");
                    }
                    return starttype === tt._import ? this.parseImport(node) : this.parseExport(node);

                    // If the statement does not start with a statement keyword or a
                    // brace, it's an ExpressionStatement or LabeledStatement. We
                    // simply start parsing an expression, and afterwards, if the
                    // next token is a colon and the expression was a simple
                    // Identifier node, we switch to interpreting it as a label.
                default:
                    var maybeName = this.value,
                        expr = this.parseExpression();
                    if (starttype === tt.name && expr.type === "Identifier" && this.eat(tt.colon)) return this.parseLabeledStatement(node, maybeName, expr);
                    else return this.parseExpressionStatement(node, expr);
                }
            };

            pp.parseBreakContinueStatement = function(node, keyword) {
                var isBreak = keyword == "break";
                this.next();
                if (this.eat(tt.semi) || this.insertSemicolon()) node.label = null;
                else if (this.type !== tt.name) this.unexpected();
                else {
                    node.label = this.parseIdent();
                    this.semicolon();
                }

                // Verify that there is an actual destination to break or
                // continue to.
                for (var i = 0; i < this.labels.length; ++i) {
                    var lab = this.labels[i];
                    if (node.label == null || lab.name === node.label.name) {
                        if (lab.kind != null && (isBreak || lab.kind === "loop")) break;
                        if (node.label && isBreak) break;
                    }
                }
                if (i === this.labels.length) this.raise(node.start, "Unsyntactic " + keyword);
                return this.finishNode(node, isBreak ? "BreakStatement" : "ContinueStatement");
            };

            pp.parseDebuggerStatement = function(node) {
                this.next();
                this.semicolon();
                return this.finishNode(node, "DebuggerStatement");
            };

            pp.parseDoStatement = function(node) {
                this.next();
                this.labels.push(loopLabel);
                node.body = this.parseStatement(false);
                this.labels.pop();
                this.expect(tt._while);
                node.test = this.parseParenExpression();
                if (this.options.ecmaVersion >= 6) this.eat(tt.semi);
                else this.semicolon();
                return this.finishNode(node, "DoWhileStatement");
            };

            // Disambiguating between a `for` and a `for`/`in` or `for`/`of`
            // loop is non-trivial. Basically, we have to parse the init `var`
            // statement or expression, disallowing the `in` operator (see
            // the second parameter to `parseExpression`), and then check
            // whether the next token is `in` or `of`. When there is no init
            // part (semicolon immediately after the opening parenthesis), it
            // is a regular `for` loop.

            pp.parseForStatement = function(node) {
                this.next();
                this.labels.push(loopLabel);
                this.expect(tt.parenL);
                if (this.type === tt.semi) return this.parseFor(node, null);
                if (this.type === tt._var || this.type === tt._let || this.type === tt._const) {
                    var _init = this.startNode(),
                        varKind = this.type;
                    this.next();
                    this.parseVar(_init, true, varKind);
                    this.finishNode(_init, "VariableDeclaration");
                    if ((this.type === tt._in || this.options.ecmaVersion >= 6 && this.isContextual("of")) && _init.declarations.length === 1 && !(varKind !== tt._var && _init.declarations[0].init)) return this.parseForIn(node, _init);
                    return this.parseFor(node, _init);
                }
                var refShorthandDefaultPos = {
                    start: 0
                };
                var init = this.parseExpression(true, refShorthandDefaultPos);
                if (this.type === tt._in || this.options.ecmaVersion >= 6 && this.isContextual("of")) {
                    this.toAssignable(init);
                    this.checkLVal(init);
                    return this.parseForIn(node, init);
                }
                else if (refShorthandDefaultPos.start) {
                    this.unexpected(refShorthandDefaultPos.start);
                }
                return this.parseFor(node, init);
            };

            pp.parseFunctionStatement = function(node) {
                this.next();
                return this.parseFunction(node, true);
            };

            pp.parseIfStatement = function(node) {
                this.next();
                node.test = this.parseParenExpression();
                node.consequent = this.parseStatement(false);
                node.alternate = this.eat(tt._else) ? this.parseStatement(false) : null;
                return this.finishNode(node, "IfStatement");
            };

            pp.parseReturnStatement = function(node) {
                if (!this.inFunction && !this.options.allowReturnOutsideFunction) this.raise(this.start, "'return' outside of function");
                this.next();

                // In `return` (and `break`/`continue`), the keywords with
                // optional arguments, we eagerly look for a semicolon or the
                // possibility to insert one.

                if (this.eat(tt.semi) || this.insertSemicolon()) node.argument = null;
                else {
                    node.argument = this.parseExpression();
                    this.semicolon();
                }
                return this.finishNode(node, "ReturnStatement");
            };

            pp.parseSwitchStatement = function(node) {
                this.next();
                node.discriminant = this.parseParenExpression();
                node.cases = [];
                this.expect(tt.braceL);
                this.labels.push(switchLabel);

                // Statements under must be grouped (by label) in SwitchCase
                // nodes. `cur` is used to keep the node that we are currently
                // adding statements to.

                for (var cur, sawDefault; this.type != tt.braceR;) {
                    if (this.type === tt._case || this.type === tt._default) {
                        var isCase = this.type === tt._case;
                        if (cur) this.finishNode(cur, "SwitchCase");
                        node.cases.push(cur = this.startNode());
                        cur.consequent = [];
                        this.next();
                        if (isCase) {
                            cur.test = this.parseExpression();
                        }
                        else {
                            if (sawDefault) this.raise(this.lastTokStart, "Multiple default clauses");
                            sawDefault = true;
                            cur.test = null;
                        }
                        this.expect(tt.colon);
                    }
                    else {
                        if (!cur) this.unexpected();
                        cur.consequent.push(this.parseStatement(true));
                    }
                }
                if (cur) this.finishNode(cur, "SwitchCase");
                this.next(); // Closing brace
                this.labels.pop();
                return this.finishNode(node, "SwitchStatement");
            };

            pp.parseThrowStatement = function(node) {
                this.next();
                if (lineBreak.test(this.input.slice(this.lastTokEnd, this.start))) this.raise(this.lastTokEnd, "Illegal newline after throw");
                node.argument = this.parseExpression();
                this.semicolon();
                return this.finishNode(node, "ThrowStatement");
            };

            // Reused empty array added for node fields that are always empty.

            var empty = [];

            pp.parseTryStatement = function(node) {
                this.next();
                node.block = this.parseBlock();
                node.handler = null;
                if (this.type === tt._catch) {
                    var clause = this.startNode();
                    this.next();
                    this.expect(tt.parenL);
                    clause.param = this.parseBindingAtom();
                    this.checkLVal(clause.param, true);
                    this.expect(tt.parenR);
                    clause.guard = null;
                    clause.body = this.parseBlock();
                    node.handler = this.finishNode(clause, "CatchClause");
                }
                node.guardedHandlers = empty;
                node.finalizer = this.eat(tt._finally) ? this.parseBlock() : null;
                if (!node.handler && !node.finalizer) this.raise(node.start, "Missing catch or finally clause");
                return this.finishNode(node, "TryStatement");
            };

            pp.parseVarStatement = function(node, kind) {
                this.next();
                this.parseVar(node, false, kind);
                this.semicolon();
                return this.finishNode(node, "VariableDeclaration");
            };

            pp.parseWhileStatement = function(node) {
                this.next();
                node.test = this.parseParenExpression();
                this.labels.push(loopLabel);
                node.body = this.parseStatement(false);
                this.labels.pop();
                return this.finishNode(node, "WhileStatement");
            };

            pp.parseWithStatement = function(node) {
                if (this.strict) this.raise(this.start, "'with' in strict mode");
                this.next();
                node.object = this.parseParenExpression();
                node.body = this.parseStatement(false);
                return this.finishNode(node, "WithStatement");
            };

            pp.parseEmptyStatement = function(node) {
                this.next();
                return this.finishNode(node, "EmptyStatement");
            };

            pp.parseLabeledStatement = function(node, maybeName, expr) {
                for (var i = 0; i < this.labels.length; ++i) {
                    if (this.labels[i].name === maybeName) this.raise(expr.start, "Label '" + maybeName + "' is already declared");
                }
                var kind = this.type.isLoop ? "loop" : this.type === tt._switch ? "switch" : null;
                this.labels.push({
                    name: maybeName,
                    kind: kind
                });
                node.body = this.parseStatement(true);
                this.labels.pop();
                node.label = expr;
                return this.finishNode(node, "LabeledStatement");
            };

            pp.parseExpressionStatement = function(node, expr) {
                node.expression = expr;
                this.semicolon();
                return this.finishNode(node, "ExpressionStatement");
            };

            // Parse a semicolon-enclosed block of statements, handling `"use
            // strict"` declarations when `allowStrict` is true (used for
            // function bodies).

            pp.parseBlock = function(allowStrict) {
                var node = this.startNode(),
                    first = true,
                    oldStrict = undefined;
                node.body = [];
                this.expect(tt.braceL);
                while (!this.eat(tt.braceR)) {
                    var stmt = this.parseStatement(true);
                    node.body.push(stmt);
                    if (first && allowStrict && this.isUseStrict(stmt)) {
                        oldStrict = this.strict;
                        this.setStrict(this.strict = true);
                    }
                    first = false;
                }
                if (oldStrict === false) this.setStrict(false);
                return this.finishNode(node, "BlockStatement");
            };

            // Parse a regular `for` loop. The disambiguation code in
            // `parseStatement` will already have parsed the init statement or
            // expression.

            pp.parseFor = function(node, init) {
                node.init = init;
                this.expect(tt.semi);
                node.test = this.type === tt.semi ? null : this.parseExpression();
                this.expect(tt.semi);
                node.update = this.type === tt.parenR ? null : this.parseExpression();
                this.expect(tt.parenR);
                node.body = this.parseStatement(false);
                this.labels.pop();
                return this.finishNode(node, "ForStatement");
            };

            // Parse a `for`/`in` and `for`/`of` loop, which are almost
            // same from parser's perspective.

            pp.parseForIn = function(node, init) {
                var type = this.type === tt._in ? "ForInStatement" : "ForOfStatement";
                this.next();
                node.left = init;
                node.right = this.parseExpression();
                this.expect(tt.parenR);
                node.body = this.parseStatement(false);
                this.labels.pop();
                return this.finishNode(node, type);
            };

            // Parse a list of variable declarations.

            pp.parseVar = function(node, isFor, kind) {
                node.declarations = [];
                node.kind = kind.keyword;
                for (;;) {
                    var decl = this.startNode();
                    decl.id = this.parseBindingAtom();
                    this.checkLVal(decl.id, true);
                    if (this.eat(tt.eq)) {
                        decl.init = this.parseMaybeAssign(isFor);
                    }
                    else if (kind === tt._const && !(this.type === tt._in || this.options.ecmaVersion >= 6 && this.isContextual("of"))) {
                        this.unexpected();
                    }
                    else if (decl.id.type != "Identifier" && !(isFor && (this.type === tt._in || this.isContextual("of")))) {
                        this.raise(this.lastTokEnd, "Complex binding patterns require an initialization value");
                    }
                    else {
                        decl.init = null;
                    }
                    node.declarations.push(this.finishNode(decl, "VariableDeclarator"));
                    if (!this.eat(tt.comma)) break;
                }
                return node;
            };

            // Parse a function declaration or literal (depending on the
            // `isStatement` parameter).

            pp.parseFunction = function(node, isStatement, allowExpressionBody) {
                this.initFunction(node);
                if (this.options.ecmaVersion >= 6) node.generator = this.eat(tt.star);
                if (isStatement || this.type === tt.name) node.id = this.parseIdent();
                this.expect(tt.parenL);
                node.params = this.parseBindingList(tt.parenR, false, false);
                this.parseFunctionBody(node, allowExpressionBody);
                return this.finishNode(node, isStatement ? "FunctionDeclaration" : "FunctionExpression");
            };

            // Parse a class declaration or literal (depending on the
            // `isStatement` parameter).

            pp.parseClass = function(node, isStatement) {
                this.next();
                node.id = this.type === tt.name ? this.parseIdent() : isStatement ? this.unexpected() : null;
                node.superClass = this.eat(tt._extends) ? this.parseExprSubscripts() : null;
                var classBody = this.startNode();
                classBody.body = [];
                this.expect(tt.braceL);
                while (!this.eat(tt.braceR)) {
                    if (this.eat(tt.semi)) continue;
                    var method = this.startNode();
                    var isGenerator = this.eat(tt.star);
                    this.parsePropertyName(method);
                    if (this.type !== tt.parenL && !method.computed && method.key.type === "Identifier" && method.key.name === "static") {
                        if (isGenerator) this.unexpected();
                        method["static"] = true;
                        isGenerator = this.eat(tt.star);
                        this.parsePropertyName(method);
                    }
                    else {
                        method["static"] = false;
                    }
                    method.kind = "method";
                    if (!method.computed && !isGenerator) {
                        if (method.key.type === "Identifier") {
                            if (this.type !== tt.parenL && (method.key.name === "get" || method.key.name === "set")) {
                                method.kind = method.key.name;
                                this.parsePropertyName(method);
                            }
                            else if (!method["static"] && method.key.name === "constructor") {
                                method.kind = "constructor";
                            }
                        }
                        else if (!method["static"] && method.key.type === "Literal" && method.key.value === "constructor") {
                            method.kind = "constructor";
                        }
                    }
                    method.value = this.parseMethod(isGenerator);
                    classBody.body.push(this.finishNode(method, "MethodDefinition"));
                }
                node.body = this.finishNode(classBody, "ClassBody");
                return this.finishNode(node, isStatement ? "ClassDeclaration" : "ClassExpression");
            };

            // Parses module export declaration.

            pp.parseExport = function(node) {
                this.next();
                // export * from '...'
                if (this.eat(tt.star)) {
                    this.expectContextual("from");
                    node.source = this.type === tt.string ? this.parseExprAtom() : this.unexpected();
                    this.semicolon();
                    return this.finishNode(node, "ExportAllDeclaration");
                }
                if (this.eat(tt._default)) {
                    // export default ...
                    var expr = this.parseMaybeAssign();
                    var needsSemi = true;
                    if (expr.type == "FunctionExpression" || expr.type == "ClassExpression") {
                        needsSemi = false;
                        if (expr.id) {
                            expr.type = expr.type == "FunctionExpression" ? "FunctionDeclaration" : "ClassDeclaration";
                        }
                    }
                    node.declaration = expr;
                    if (needsSemi) this.semicolon();
                    return this.finishNode(node, "ExportDefaultDeclaration");
                }
                // export var|const|let|function|class ...
                if (this.type.keyword) {
                    node.declaration = this.parseStatement(true);
                    node.specifiers = [];
                    node.source = null;
                }
                else {
                    // export { x, y as z } [from '...']
                    node.declaration = null;
                    node.specifiers = this.parseExportSpecifiers();
                    if (this.eatContextual("from")) {
                        node.source = this.type === tt.string ? this.parseExprAtom() : this.unexpected();
                    }
                    else {
                        node.source = null;
                    }
                    this.semicolon();
                }
                return this.finishNode(node, "ExportNamedDeclaration");
            };

            // Parses a comma-separated list of module exports.

            pp.parseExportSpecifiers = function() {
                var nodes = [],
                    first = true;
                // export { x, y as z } [from '...']
                this.expect(tt.braceL);
                while (!this.eat(tt.braceR)) {
                    if (!first) {
                        this.expect(tt.comma);
                        if (this.afterTrailingComma(tt.braceR)) break;
                    }
                    else first = false;

                    var node = this.startNode();
                    node.local = this.parseIdent(this.type === tt._default);
                    node.exported = this.eatContextual("as") ? this.parseIdent(true) : node.local;
                    nodes.push(this.finishNode(node, "ExportSpecifier"));
                }
                return nodes;
            };

            // Parses import declaration.

            pp.parseImport = function(node) {
                this.next();
                // import '...'
                if (this.type === tt.string) {
                    node.specifiers = empty;
                    node.source = this.parseExprAtom();
                    node.kind = "";
                }
                else {
                    node.specifiers = this.parseImportSpecifiers();
                    this.expectContextual("from");
                    node.source = this.type === tt.string ? this.parseExprAtom() : this.unexpected();
                }
                this.semicolon();
                return this.finishNode(node, "ImportDeclaration");
            };

            // Parses a comma-separated list of module imports.

            pp.parseImportSpecifiers = function() {
                var nodes = [],
                    first = true;
                if (this.type === tt.name) {
                    // import defaultObj, { x, y as z } from '...'
                    var node = this.startNode();
                    node.local = this.parseIdent();
                    this.checkLVal(node.local, true);
                    nodes.push(this.finishNode(node, "ImportDefaultSpecifier"));
                    if (!this.eat(tt.comma)) return nodes;
                }
                if (this.type === tt.star) {
                    var node = this.startNode();
                    this.next();
                    this.expectContextual("as");
                    node.local = this.parseIdent();
                    this.checkLVal(node.local, true);
                    nodes.push(this.finishNode(node, "ImportNamespaceSpecifier"));
                    return nodes;
                }
                this.expect(tt.braceL);
                while (!this.eat(tt.braceR)) {
                    if (!first) {
                        this.expect(tt.comma);
                        if (this.afterTrailingComma(tt.braceR)) break;
                    }
                    else first = false;

                    var node = this.startNode();
                    node.imported = this.parseIdent(true);
                    node.local = this.eatContextual("as") ? this.parseIdent() : node.imported;
                    this.checkLVal(node.local, true);
                    nodes.push(this.finishNode(node, "ImportSpecifier"));
                }
                return nodes;
            };

        }, {
            "./state": 9,
            "./tokentype": 13,
            "./whitespace": 15
        }],
        11: [function(_dereq_, module, exports) {
            "use strict";

            var _classCallCheck = function(instance, Constructor) {
                if (!(instance instanceof Constructor)) {
                    throw new TypeError("Cannot call a class as a function");
                }
            };

            Object.defineProperty(exports, "__esModule", {
                value: true
            });
            // The algorithm used to determine whether a regexp can appear at a
            // given point in the program is loosely based on sweet.js' approach.
            // See https://github.com/mozilla/sweet.js/wiki/design

            var Parser = _dereq_("./state").Parser;

            var tt = _dereq_("./tokentype").types;

            var lineBreak = _dereq_("./whitespace").lineBreak;

            var TokContext = exports.TokContext = function TokContext(token, isExpr, preserveSpace, override) {
                _classCallCheck(this, TokContext);

                this.token = token;
                this.isExpr = isExpr;
                this.preserveSpace = preserveSpace;
                this.override = override;
            };

            var types = {
                b_stat: new TokContext("{", false),
                b_expr: new TokContext("{", true),
                b_tmpl: new TokContext("${", true),
                p_stat: new TokContext("(", false),
                p_expr: new TokContext("(", true),
                q_tmpl: new TokContext("`", true, true, function(p) {
                    return p.readTmplToken();
                }),
                f_expr: new TokContext("function", true)
            };

            exports.types = types;
            var pp = Parser.prototype;

            pp.initialContext = function() {
                return [types.b_stat];
            };

            pp.braceIsBlock = function(prevType) {
                var parent = undefined;
                if (prevType === tt.colon && (parent = this.curContext()).token == "{") return !parent.isExpr;
                if (prevType === tt._return) return lineBreak.test(this.input.slice(this.lastTokEnd, this.start));
                if (prevType === tt._else || prevType === tt.semi || prevType === tt.eof) return true;
                if (prevType == tt.braceL) return this.curContext() === types.b_stat;
                return !this.exprAllowed;
            };

            pp.updateContext = function(prevType) {
                var update = undefined,
                    type = this.type;
                if (type.keyword && prevType == tt.dot) this.exprAllowed = false;
                else if (update = type.updateContext) update.call(this, prevType);
                else this.exprAllowed = type.beforeExpr;
            };

            // Token-specific context update code

            tt.parenR.updateContext = tt.braceR.updateContext = function() {
                if (this.context.length == 1) {
                    this.exprAllowed = true;
                    return;
                }
                var out = this.context.pop();
                if (out === types.b_stat && this.curContext() === types.f_expr) {
                    this.context.pop();
                    this.exprAllowed = false;
                }
                else if (out === types.b_tmpl) {
                    this.exprAllowed = true;
                }
                else {
                    this.exprAllowed = !out.isExpr;
                }
            };

            tt.braceL.updateContext = function(prevType) {
                this.context.push(this.braceIsBlock(prevType) ? types.b_stat : types.b_expr);
                this.exprAllowed = true;
            };

            tt.dollarBraceL.updateContext = function() {
                this.context.push(types.b_tmpl);
                this.exprAllowed = true;
            };

            tt.parenL.updateContext = function(prevType) {
                var statementParens = prevType === tt._if || prevType === tt._for || prevType === tt._with || prevType === tt._while;
                this.context.push(statementParens ? types.p_stat : types.p_expr);
                this.exprAllowed = true;
            };

            tt.incDec.updateContext = function() {};

            tt._function.updateContext = function() {
                if (this.curContext() !== types.b_stat) this.context.push(types.f_expr);
                this.exprAllowed = false;
            };

            tt.backQuote.updateContext = function() {
                if (this.curContext() === types.q_tmpl) this.context.pop();
                else this.context.push(types.q_tmpl);
                this.exprAllowed = false;
            };

            // tokExprAllowed stays unchanged

        }, {
            "./state": 9,
            "./tokentype": 13,
            "./whitespace": 15
        }],
        12: [function(_dereq_, module, exports) {
            "use strict";

            var _classCallCheck = function(instance, Constructor) {
                if (!(instance instanceof Constructor)) {
                    throw new TypeError("Cannot call a class as a function");
                }
            };

            Object.defineProperty(exports, "__esModule", {
                value: true
            });

            var _identifier = _dereq_("./identifier");

            var isIdentifierStart = _identifier.isIdentifierStart;
            var isIdentifierChar = _identifier.isIdentifierChar;

            var _tokentype = _dereq_("./tokentype");

            var tt = _tokentype.types;
            var keywordTypes = _tokentype.keywords;

            var Parser = _dereq_("./state").Parser;

            var SourceLocation = _dereq_("./location").SourceLocation;

            var _whitespace = _dereq_("./whitespace");

            var lineBreak = _whitespace.lineBreak;
            var lineBreakG = _whitespace.lineBreakG;
            var isNewLine = _whitespace.isNewLine;
            var nonASCIIwhitespace = _whitespace.nonASCIIwhitespace;

            // Object type used to represent tokens. Note that normally, tokens
            // simply exist as properties on the parser object. This is only
            // used for the onToken callback and the external tokenizer.

            var Token = exports.Token = function Token(p) {
                _classCallCheck(this, Token);

                this.type = p.type;
                this.value = p.value;
                this.start = p.start;
                this.end = p.end;
                if (p.options.locations) this.loc = new SourceLocation(p, p.startLoc, p.endLoc);
                if (p.options.ranges) this.range = [p.start, p.end];
            };

            // ## Tokenizer

            var pp = Parser.prototype;

            // Move to the next token

            pp.next = function() {
                if (this.options.onToken) this.options.onToken(new Token(this));

                this.lastTokEnd = this.end;
                this.lastTokStart = this.start;
                this.lastTokEndLoc = this.endLoc;
                this.lastTokStartLoc = this.startLoc;
                this.nextToken();
            };

            pp.getToken = function() {
                this.next();
                return new Token(this);
            };

            // If we're in an ES6 environment, make parsers iterable
            if (typeof Symbol !== "undefined") pp[Symbol.iterator] = function() {
                var self = this;
                return {
                    next: function next() {
                        var token = self.getToken();
                        return {
                            done: token.type === tt.eof,
                            value: token
                        };
                    }
                };
            };

            // Toggle strict mode. Re-reads the next number or string to please
            // pedantic tests (`"use strict"; 010;` should fail).

            pp.setStrict = function(strict) {
                this.strict = strict;
                if (this.type !== tt.num && this.type !== tt.string) return;
                this.pos = this.start;
                if (this.options.locations) {
                    while (this.pos < this.lineStart) {
                        this.lineStart = this.input.lastIndexOf("\n", this.lineStart - 2) + 1;
                        --this.curLine;
                    }
                }
                this.nextToken();
            };

            pp.curContext = function() {
                return this.context[this.context.length - 1];
            };

            // Read a single token, updating the parser object's token-related
            // properties.

            pp.nextToken = function() {
                var curContext = this.curContext();
                if (!curContext || !curContext.preserveSpace) this.skipSpace();

                this.start = this.pos;
                if (this.options.locations) this.startLoc = this.curPosition();
                if (this.pos >= this.input.length) return this.finishToken(tt.eof);

                if (curContext.override) return curContext.override(this);
                else this.readToken(this.fullCharCodeAtPos());
            };

            pp.readToken = function(code) {
                // Identifier or keyword. '\uXXXX' sequences are allowed in
                // identifiers, so '\' also dispatches to that.
                if (isIdentifierStart(code, this.options.ecmaVersion >= 6) || code === 92 /* '\' */ ) return this.readWord();

                return this.getTokenFromCode(code);
            };

            pp.fullCharCodeAtPos = function() {
                var code = this.input.charCodeAt(this.pos);
                if (code <= 55295 || code >= 57344) return code;
                var next = this.input.charCodeAt(this.pos + 1);
                return (code << 10) + next - 56613888;
            };

            pp.skipBlockComment = function() {
                var startLoc = this.options.onComment && this.options.locations && this.curPosition();
                var start = this.pos,
                    end = this.input.indexOf("*/", this.pos += 2);
                if (end === -1) this.raise(this.pos - 2, "Unterminated comment");
                this.pos = end + 2;
                if (this.options.locations) {
                    lineBreakG.lastIndex = start;
                    var match = undefined;
                    while ((match = lineBreakG.exec(this.input)) && match.index < this.pos) {
                        ++this.curLine;
                        this.lineStart = match.index + match[0].length;
                    }
                }
                if (this.options.onComment) this.options.onComment(true, this.input.slice(start + 2, end), start, this.pos, startLoc, this.options.locations && this.curPosition());
            };

            pp.skipLineComment = function(startSkip) {
                var start = this.pos;
                var startLoc = this.options.onComment && this.options.locations && this.curPosition();
                var ch = this.input.charCodeAt(this.pos += startSkip);
                while (this.pos < this.input.length && ch !== 10 && ch !== 13 && ch !== 8232 && ch !== 8233) {
                    ++this.pos;
                    ch = this.input.charCodeAt(this.pos);
                }
                if (this.options.onComment) this.options.onComment(false, this.input.slice(start + startSkip, this.pos), start, this.pos, startLoc, this.options.locations && this.curPosition());
            };

            // Called at the start of the parse and after every token. Skips
            // whitespace and comments, and.

            pp.skipSpace = function() {
                while (this.pos < this.input.length) {
                    var ch = this.input.charCodeAt(this.pos);
                    if (ch === 32) {
                        // ' '
                        ++this.pos;
                    }
                    else if (ch === 13) {
                        ++this.pos;
                        var next = this.input.charCodeAt(this.pos);
                        if (next === 10) {
                            ++this.pos;
                        }
                        if (this.options.locations) {
                            ++this.curLine;
                            this.lineStart = this.pos;
                        }
                    }
                    else if (ch === 10 || ch === 8232 || ch === 8233) {
                        ++this.pos;
                        if (this.options.locations) {
                            ++this.curLine;
                            this.lineStart = this.pos;
                        }
                    }
                    else if (ch > 8 && ch < 14) {
                        ++this.pos;
                    }
                    else if (ch === 47) {
                        // '/'
                        var next = this.input.charCodeAt(this.pos + 1);
                        if (next === 42) {
                            // '*'
                            this.skipBlockComment();
                        }
                        else if (next === 47) {
                            // '/'
                            this.skipLineComment(2);
                        }
                        else break;
                    }
                    else if (ch === 160) {
                        // '\xa0'
                        ++this.pos;
                    }
                    else if (ch >= 5760 && nonASCIIwhitespace.test(String.fromCharCode(ch))) {
                        ++this.pos;
                    }
                    else {
                        break;
                    }
                }
            };

            // Called at the end of every token. Sets `end`, `val`, and
            // maintains `context` and `exprAllowed`, and skips the space after
            // the token, so that the next one's `start` will point at the
            // right position.

            pp.finishToken = function(type, val) {
                this.end = this.pos;
                if (this.options.locations) this.endLoc = this.curPosition();
                var prevType = this.type;
                this.type = type;
                this.value = val;

                this.updateContext(prevType);
            };

            // ### Token reading

            // This is the function that is called to fetch the next token. It
            // is somewhat obscure, because it works in character codes rather
            // than characters, and because operator parsing has been inlined
            // into it.
            //
            // All in the name of speed.
            //
            pp.readToken_dot = function() {
                var next = this.input.charCodeAt(this.pos + 1);
                if (next >= 48 && next <= 57) return this.readNumber(true);
                var next2 = this.input.charCodeAt(this.pos + 2);
                if (this.options.ecmaVersion >= 6 && next === 46 && next2 === 46) {
                    // 46 = dot '.'
                    this.pos += 3;
                    return this.finishToken(tt.ellipsis);
                }
                else {
                    ++this.pos;
                    return this.finishToken(tt.dot);
                }
            };

            pp.readToken_slash = function() {
                // '/'
                var next = this.input.charCodeAt(this.pos + 1);
                if (this.exprAllowed) {
                    ++this.pos;
                    return this.readRegexp();
                }
                if (next === 61) return this.finishOp(tt.assign, 2);
                return this.finishOp(tt.slash, 1);
            };

            pp.readToken_mult_modulo = function(code) {
                // '%*'
                var next = this.input.charCodeAt(this.pos + 1);
                if (next === 61) return this.finishOp(tt.assign, 2);
                return this.finishOp(code === 42 ? tt.star : tt.modulo, 1);
            };

            pp.readToken_pipe_amp = function(code) {
                // '|&'
                var next = this.input.charCodeAt(this.pos + 1);
                if (next === code) return this.finishOp(code === 124 ? tt.logicalOR : tt.logicalAND, 2);
                if (next === 61) return this.finishOp(tt.assign, 2);
                return this.finishOp(code === 124 ? tt.bitwiseOR : tt.bitwiseAND, 1);
            };

            pp.readToken_caret = function() {
                // '^'
                var next = this.input.charCodeAt(this.pos + 1);
                if (next === 61) return this.finishOp(tt.assign, 2);
                return this.finishOp(tt.bitwiseXOR, 1);
            };

            pp.readToken_plus_min = function(code) {
                // '+-'
                var next = this.input.charCodeAt(this.pos + 1);
                if (next === code) {
                    if (next == 45 && this.input.charCodeAt(this.pos + 2) == 62 && lineBreak.test(this.input.slice(this.lastTokEnd, this.pos))) {
                        // A `-->` line comment
                        this.skipLineComment(3);
                        this.skipSpace();
                        return this.nextToken();
                    }
                    return this.finishOp(tt.incDec, 2);
                }
                if (next === 61) return this.finishOp(tt.assign, 2);
                return this.finishOp(tt.plusMin, 1);
            };

            pp.readToken_lt_gt = function(code) {
                // '<>'
                var next = this.input.charCodeAt(this.pos + 1);
                var size = 1;
                if (next === code) {
                    size = code === 62 && this.input.charCodeAt(this.pos + 2) === 62 ? 3 : 2;
                    if (this.input.charCodeAt(this.pos + size) === 61) return this.finishOp(tt.assign, size + 1);
                    return this.finishOp(tt.bitShift, size);
                }
                if (next == 33 && code == 60 && this.input.charCodeAt(this.pos + 2) == 45 && this.input.charCodeAt(this.pos + 3) == 45) {
                    if (this.inModule) unexpected();
                    // `<!--`, an XML-style comment that should be interpreted as a line comment
                    this.skipLineComment(4);
                    this.skipSpace();
                    return this.nextToken();
                }
                if (next === 61) size = this.input.charCodeAt(this.pos + 2) === 61 ? 3 : 2;
                return this.finishOp(tt.relational, size);
            };

            pp.readToken_eq_excl = function(code) {
                // '=!'
                var next = this.input.charCodeAt(this.pos + 1);
                if (next === 61) return this.finishOp(tt.equality, this.input.charCodeAt(this.pos + 2) === 61 ? 3 : 2);
                if (code === 61 && next === 62 && this.options.ecmaVersion >= 6) {
                    // '=>'
                    this.pos += 2;
                    return this.finishToken(tt.arrow);
                }
                return this.finishOp(code === 61 ? tt.eq : tt.prefix, 1);
            };

            pp.getTokenFromCode = function(code) {
                switch (code) {
                    // The interpretation of a dot depends on whether it is followed
                    // by a digit or another two dots.
                case 46:
                    // '.'
                    return this.readToken_dot();

                    // Punctuation tokens.
                case 40:
                    ++this.pos;
                    return this.finishToken(tt.parenL);
                case 41:
                    ++this.pos;
                    return this.finishToken(tt.parenR);
                case 59:
                    ++this.pos;
                    return this.finishToken(tt.semi);
                case 44:
                    ++this.pos;
                    return this.finishToken(tt.comma);
                case 91:
                    ++this.pos;
                    return this.finishToken(tt.bracketL);
                case 93:
                    ++this.pos;
                    return this.finishToken(tt.bracketR);
                case 123:
                    ++this.pos;
                    return this.finishToken(tt.braceL);
                case 125:
                    ++this.pos;
                    return this.finishToken(tt.braceR);
                case 58:
                    ++this.pos;
                    return this.finishToken(tt.colon);
                case 63:
                    ++this.pos;
                    return this.finishToken(tt.question);

                case 96:
                    // '`'
                    if (this.options.ecmaVersion < 6) break;
                    ++this.pos;
                    return this.finishToken(tt.backQuote);

                case 48:
                    // '0'
                    var next = this.input.charCodeAt(this.pos + 1);
                    if (next === 120 || next === 88) return this.readRadixNumber(16); // '0x', '0X' - hex number
                    if (this.options.ecmaVersion >= 6) {
                        if (next === 111 || next === 79) return this.readRadixNumber(8); // '0o', '0O' - octal number
                        if (next === 98 || next === 66) return this.readRadixNumber(2); // '0b', '0B' - binary number
                    }
                    // Anything else beginning with a digit is an integer, octal
                    // number, or float.
                case 49:
                case 50:
                case 51:
                case 52:
                case 53:
                case 54:
                case 55:
                case 56:
                case 57:
                    // 1-9
                    return this.readNumber(false);

                    // Quotes produce strings.
                case 34:
                case 39:
                    // '"', "'"
                    return this.readString(code);

                    // Operators are parsed inline in tiny state machines. '=' (61) is
                    // often referred to. `finishOp` simply skips the amount of
                    // characters it is given as second argument, and returns a token
                    // of the type given by its first argument.

                case 47:
                    // '/'
                    return this.readToken_slash();

                case 37:
                case 42:
                    // '%*'
                    return this.readToken_mult_modulo(code);

                case 124:
                case 38:
                    // '|&'
                    return this.readToken_pipe_amp(code);

                case 94:
                    // '^'
                    return this.readToken_caret();

                case 43:
                case 45:
                    // '+-'
                    return this.readToken_plus_min(code);

                case 60:
                case 62:
                    // '<>'
                    return this.readToken_lt_gt(code);

                case 61:
                case 33:
                    // '=!'
                    return this.readToken_eq_excl(code);

                case 126:
                    // '~'
                    return this.finishOp(tt.prefix, 1);
                }

                this.raise(this.pos, "Unexpected character '" + codePointToString(code) + "'");
            };

            pp.finishOp = function(type, size) {
                var str = this.input.slice(this.pos, this.pos + size);
                this.pos += size;
                return this.finishToken(type, str);
            };

            var regexpUnicodeSupport = false;
            try {
                new RegExp("￿", "u");
                regexpUnicodeSupport = true;
            }
            catch (e) {}

            // Parse a regular expression. Some context-awareness is necessary,
            // since a '/' inside a '[]' set does not end the expression.

            pp.readRegexp = function() {
                var escaped = undefined,
                    inClass = undefined,
                    start = this.pos;
                for (;;) {
                    if (this.pos >= this.input.length) this.raise(start, "Unterminated regular expression");
                    var ch = this.input.charAt(this.pos);
                    if (lineBreak.test(ch)) this.raise(start, "Unterminated regular expression");
                    if (!escaped) {
                        if (ch === "[") inClass = true;
                        else if (ch === "]" && inClass) inClass = false;
                        else if (ch === "/" && !inClass) break;
                        escaped = ch === "\\";
                    }
                    else escaped = false;
                    ++this.pos;
                }
                var content = this.input.slice(start, this.pos);
                ++this.pos;
                // Need to use `readWord1` because '\uXXXX' sequences are allowed
                // here (don't ask).
                var mods = this.readWord1();
                var tmp = content;
                if (mods) {
                    var validFlags = /^[gmsiy]*$/;
                    if (this.options.ecmaVersion >= 6) validFlags = /^[gmsiyu]*$/;
                    if (!validFlags.test(mods)) this.raise(start, "Invalid regular expression flag");
                    if (mods.indexOf("u") >= 0 && !regexpUnicodeSupport) {
                        // Replace each astral symbol and every Unicode escape sequence that
                        // possibly represents an astral symbol or a paired surrogate with a
                        // single ASCII symbol to avoid throwing on regular expressions that
                        // are only valid in combination with the `/u` flag.
                        // Note: replacing with the ASCII symbol `x` might cause false
                        // negatives in unlikely scenarios. For example, `[\u{61}-b]` is a
                        // perfectly valid pattern that is equivalent to `[a-b]`, but it would
                        // be replaced by `[x-b]` which throws an error.
                        tmp = tmp.replace(/\\u([a-fA-F0-9]{4})|\\u\{([0-9a-fA-F]+)\}|[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "x");
                    }
                }
                // Detect invalid regular expressions.
                try {
                    new RegExp(tmp);
                }
                catch (e) {
                    if (e instanceof SyntaxError) this.raise(start, "Error parsing regular expression: " + e.message);
                    this.raise(e);
                }
                // Get a regular expression object for this pattern-flag pair, or `null` in
                // case the current environment doesn't support the flags it uses.
                var value = undefined;
                try {
                    value = new RegExp(content, mods);
                }
                catch (err) {
                    value = null;
                }
                return this.finishToken(tt.regexp, {
                    pattern: content,
                    flags: mods,
                    value: value
                });
            };

            // Read an integer in the given radix. Return null if zero digits
            // were read, the integer value otherwise. When `len` is given, this
            // will return `null` unless the integer has exactly `len` digits.

            pp.readInt = function(radix, len) {
                var start = this.pos,
                    total = 0;
                for (var i = 0, e = len == null ? Infinity : len; i < e; ++i) {
                    var code = this.input.charCodeAt(this.pos),
                        val = undefined;
                    if (code >= 97) val = code - 97 + 10; // a
                    else if (code >= 65) val = code - 65 + 10; // A
                    else if (code >= 48 && code <= 57) val = code - 48; // 0-9
                    else val = Infinity;
                    if (val >= radix) break;
                    ++this.pos;
                    total = total * radix + val;
                }
                if (this.pos === start || len != null && this.pos - start !== len) return null;

                return total;
            };

            pp.readRadixNumber = function(radix) {
                this.pos += 2; // 0x
                var val = this.readInt(radix);
                if (val == null) this.raise(this.start + 2, "Expected number in radix " + radix);
                if (isIdentifierStart(this.fullCharCodeAtPos())) this.raise(this.pos, "Identifier directly after number");
                return this.finishToken(tt.num, val);
            };

            // Read an integer, octal integer, or floating-point number.

            pp.readNumber = function(startsWithDot) {
                var start = this.pos,
                    isFloat = false,
                    octal = this.input.charCodeAt(this.pos) === 48;
                if (!startsWithDot && this.readInt(10) === null) this.raise(start, "Invalid number");
                if (this.input.charCodeAt(this.pos) === 46) {
                    ++this.pos;
                    this.readInt(10);
                    isFloat = true;
                }
                var next = this.input.charCodeAt(this.pos);
                if (next === 69 || next === 101) {
                    // 'eE'
                    next = this.input.charCodeAt(++this.pos);
                    if (next === 43 || next === 45)++this.pos; // '+-'
                    if (this.readInt(10) === null) this.raise(start, "Invalid number");
                    isFloat = true;
                }
                if (isIdentifierStart(this.fullCharCodeAtPos())) this.raise(this.pos, "Identifier directly after number");

                var str = this.input.slice(start, this.pos),
                    val = undefined;
                if (isFloat) val = parseFloat(str);
                else if (!octal || str.length === 1) val = parseInt(str, 10);
                else if (/[89]/.test(str) || this.strict) this.raise(start, "Invalid number");
                else val = parseInt(str, 8);
                return this.finishToken(tt.num, val);
            };

            // Read a string value, interpreting backslash-escapes.

            pp.readCodePoint = function() {
                var ch = this.input.charCodeAt(this.pos),
                    code = undefined;

                if (ch === 123) {
                    if (this.options.ecmaVersion < 6) this.unexpected();
                    ++this.pos;
                    code = this.readHexChar(this.input.indexOf("}", this.pos) - this.pos);
                    ++this.pos;
                    if (code > 1114111) this.unexpected();
                }
                else {
                    code = this.readHexChar(4);
                }
                return code;
            };

            function codePointToString(code) {
                // UTF-16 Decoding
                if (code <= 65535) {
                    return String.fromCharCode(code);
                }
                return String.fromCharCode((code - 65536 >> 10) + 55296, (code - 65536 & 1023) + 56320);
            }

            pp.readString = function(quote) {
                var out = "",
                    chunkStart = ++this.pos;
                for (;;) {
                    if (this.pos >= this.input.length) this.raise(this.start, "Unterminated string constant");
                    var ch = this.input.charCodeAt(this.pos);
                    if (ch === quote) break;
                    if (ch === 92) {
                        // '\'
                        out += this.input.slice(chunkStart, this.pos);
                        out += this.readEscapedChar();
                        chunkStart = this.pos;
                    }
                    else {
                        if (isNewLine(ch)) this.raise(this.start, "Unterminated string constant");
                        ++this.pos;
                    }
                }
                out += this.input.slice(chunkStart, this.pos++);
                return this.finishToken(tt.string, out);
            };

            // Reads template string tokens.

            pp.readTmplToken = function() {
                var out = "",
                    chunkStart = this.pos;
                for (;;) {
                    if (this.pos >= this.input.length) this.raise(this.start, "Unterminated template");
                    var ch = this.input.charCodeAt(this.pos);
                    if (ch === 96 || ch === 36 && this.input.charCodeAt(this.pos + 1) === 123) {
                        // '`', '${'
                        if (this.pos === this.start && this.type === tt.template) {
                            if (ch === 36) {
                                this.pos += 2;
                                return this.finishToken(tt.dollarBraceL);
                            }
                            else {
                                ++this.pos;
                                return this.finishToken(tt.backQuote);
                            }
                        }
                        out += this.input.slice(chunkStart, this.pos);
                        return this.finishToken(tt.template, out);
                    }
                    if (ch === 92) {
                        // '\'
                        out += this.input.slice(chunkStart, this.pos);
                        out += this.readEscapedChar();
                        chunkStart = this.pos;
                    }
                    else if (isNewLine(ch)) {
                        out += this.input.slice(chunkStart, this.pos);
                        ++this.pos;
                        if (ch === 13 && this.input.charCodeAt(this.pos) === 10) {
                            ++this.pos;
                            out += "\n";
                        }
                        else {
                            out += String.fromCharCode(ch);
                        }
                        if (this.options.locations) {
                            ++this.curLine;
                            this.lineStart = this.pos;
                        }
                        chunkStart = this.pos;
                    }
                    else {
                        ++this.pos;
                    }
                }
            };

            // Used to read escaped characters

            pp.readEscapedChar = function() {
                var ch = this.input.charCodeAt(++this.pos);
                var octal = /^[0-7]+/.exec(this.input.slice(this.pos, this.pos + 3));
                if (octal) octal = octal[0];
                while (octal && parseInt(octal, 8) > 255) octal = octal.slice(0, - 1);
                if (octal === "0") octal = null;
                ++this.pos;
                if (octal) {
                    if (this.strict) this.raise(this.pos - 2, "Octal literal in strict mode");
                    this.pos += octal.length - 1;
                    return String.fromCharCode(parseInt(octal, 8));
                }
                else {
                    switch (ch) {
                    case 110:
                        return "\n"; // 'n' -> '\n'
                    case 114:
                        return "\r"; // 'r' -> '\r'
                    case 120:
                        return String.fromCharCode(this.readHexChar(2)); // 'x'
                    case 117:
                        return codePointToString(this.readCodePoint()); // 'u'
                    case 116:
                        return "\t"; // 't' -> '\t'
                    case 98:
                        return "\b"; // 'b' -> '\b'
                    case 118:
                        return "\u000b"; // 'v' -> '\u000b'
                    case 102:
                        return "\f"; // 'f' -> '\f'
                    case 48:
                        return "\u0000"; // 0 -> '\0'
                    case 13:
                        if (this.input.charCodeAt(this.pos) === 10)++this.pos; // '\r\n'
                    case 10:
                        // ' \n'
                        if (this.options.locations) {
                            this.lineStart = this.pos;
                            ++this.curLine;
                        }
                        return "";
                    default:
                        return String.fromCharCode(ch);
                    }
                }
            };

            // Used to read character escape sequences ('\x', '\u', '\U').

            pp.readHexChar = function(len) {
                var n = this.readInt(16, len);
                if (n === null) this.raise(this.start, "Bad character escape sequence");
                return n;
            };

            // Used to signal to callers of `readWord1` whether the word
            // contained any escape sequences. This is needed because words with
            // escape sequences must not be interpreted as keywords.

            var containsEsc;

            // Read an identifier, and return it as a string. Sets `containsEsc`
            // to whether the word contained a '\u' escape.
            //
            // Incrementally adds only escaped chars, adding other chunks as-is
            // as a micro-optimization.

            pp.readWord1 = function() {
                containsEsc = false;
                var word = "",
                    first = true,
                    chunkStart = this.pos;
                var astral = this.options.ecmaVersion >= 6;
                while (this.pos < this.input.length) {
                    var ch = this.fullCharCodeAtPos();
                    if (isIdentifierChar(ch, astral)) {
                        this.pos += ch <= 65535 ? 1 : 2;
                    }
                    else if (ch === 92) {
                        // "\"
                        containsEsc = true;
                        word += this.input.slice(chunkStart, this.pos);
                        var escStart = this.pos;
                        if (this.input.charCodeAt(++this.pos) != 117) // "u"
                        this.raise(this.pos, "Expecting Unicode escape sequence \\uXXXX");
                        ++this.pos;
                        var esc = this.readCodePoint();
                        if (!(first ? isIdentifierStart : isIdentifierChar)(esc, astral)) this.raise(escStart, "Invalid Unicode escape");
                        word += codePointToString(esc);
                        chunkStart = this.pos;
                    }
                    else {
                        break;
                    }
                    first = false;
                }
                return word + this.input.slice(chunkStart, this.pos);
            };

            // Read an identifier or keyword token. Will check for reserved
            // words when necessary.

            pp.readWord = function() {
                var word = this.readWord1();
                var type = tt.name;
                if ((this.options.ecmaVersion >= 6 || !containsEsc) && this.isKeyword(word)) type = keywordTypes[word];
                return this.finishToken(type, word);
            };

        }, {
            "./identifier": 3,
            "./location": 4,
            "./state": 9,
            "./tokentype": 13,
            "./whitespace": 15
        }],
        13: [function(_dereq_, module, exports) {
            "use strict";

            var _classCallCheck = function(instance, Constructor) {
                if (!(instance instanceof Constructor)) {
                    throw new TypeError("Cannot call a class as a function");
                }
            };

            Object.defineProperty(exports, "__esModule", {
                value: true
            });
            // ## Token types

            // The assignment of fine-grained, information-carrying type objects
            // allows the tokenizer to store the information it has about a
            // token in a way that is very cheap for the parser to look up.

            // All token type variables start with an underscore, to make them
            // easy to recognize.

            // The `beforeExpr` property is used to disambiguate between regular
            // expressions and divisions. It is set on all token types that can
            // be followed by an expression (thus, a slash after them would be a
            // regular expression).
            //
            // `isLoop` marks a keyword as starting a loop, which is important
            // to know when parsing a label, in order to allow or disallow
            // continue jumps to that label.

            var TokenType = exports.TokenType = function TokenType(label) {
                var conf = arguments[1] === undefined ? {} : arguments[1];

                _classCallCheck(this, TokenType);

                this.label = label;
                this.keyword = conf.keyword;
                this.beforeExpr = !! conf.beforeExpr;
                this.startsExpr = !! conf.startsExpr;
                this.isLoop = !! conf.isLoop;
                this.isAssign = !! conf.isAssign;
                this.prefix = !! conf.prefix;
                this.postfix = !! conf.postfix;
                this.binop = conf.binop || null;
                this.updateContext = null;
            };

            function binop(name, prec) {
                return new TokenType(name, {
                    beforeExpr: true,
                    binop: prec
                });
            }
            var beforeExpr = {
                beforeExpr: true
            },
            startsExpr = {
                startsExpr: true
            };

            var types = {
                num: new TokenType("num", startsExpr),
                regexp: new TokenType("regexp", startsExpr),
                string: new TokenType("string", startsExpr),
                name: new TokenType("name", startsExpr),
                eof: new TokenType("eof"),

                // Punctuation token types.
                bracketL: new TokenType("[", {
                    beforeExpr: true,
                    startsExpr: true
                }),
                bracketR: new TokenType("]"),
                braceL: new TokenType("{", {
                    beforeExpr: true,
                    startsExpr: true
                }),
                braceR: new TokenType("}"),
                parenL: new TokenType("(", {
                    beforeExpr: true,
                    startsExpr: true
                }),
                parenR: new TokenType(")"),
                comma: new TokenType(",", beforeExpr),
                semi: new TokenType(";", beforeExpr),
                colon: new TokenType(":", beforeExpr),
                dot: new TokenType("."),
                question: new TokenType("?", beforeExpr),
                arrow: new TokenType("=>", beforeExpr),
                template: new TokenType("template"),
                ellipsis: new TokenType("...", beforeExpr),
                backQuote: new TokenType("`", startsExpr),
                dollarBraceL: new TokenType("${", {
                    beforeExpr: true,
                    startsExpr: true
                }),

                // Operators. These carry several kinds of properties to help the
                // parser use them properly (the presence of these properties is
                // what categorizes them as operators).
                //
                // `binop`, when present, specifies that this operator is a binary
                // operator, and will refer to its precedence.
                //
                // `prefix` and `postfix` mark the operator as a prefix or postfix
                // unary operator.
                //
                // `isAssign` marks all of `=`, `+=`, `-=` etcetera, which act as
                // binary operators with a very low precedence, that should result
                // in AssignmentExpression nodes.

                eq: new TokenType("=", {
                    beforeExpr: true,
                    isAssign: true
                }),
                assign: new TokenType("_=", {
                    beforeExpr: true,
                    isAssign: true
                }),
                incDec: new TokenType("++/--", {
                    prefix: true,
                    postfix: true,
                    startsExpr: true
                }),
                prefix: new TokenType("prefix", {
                    beforeExpr: true,
                    prefix: true,
                    startsExpr: true
                }),
                logicalOR: binop("||", 1),
                logicalAND: binop("&&", 2),
                bitwiseOR: binop("|", 3),
                bitwiseXOR: binop("^", 4),
                bitwiseAND: binop("&", 5),
                equality: binop("==/!=", 6),
                relational: binop("</>", 7),
                bitShift: binop("<</>>", 8),
                plusMin: new TokenType("+/-", {
                    beforeExpr: true,
                    binop: 9,
                    prefix: true,
                    startsExpr: true
                }),
                modulo: binop("%", 10),
                star: binop("*", 10),
                slash: binop("/", 10)
            };

            exports.types = types;
            // Map keyword names to token types.

            var keywords = {};

            exports.keywords = keywords;
            // Succinct definitions of keyword token types
            function kw(name) {
                var options = arguments[1] === undefined ? {} : arguments[1];

                options.keyword = name;
                keywords[name] = types["_" + name] = new TokenType(name, options);
            }

            kw("break");
            kw("case", beforeExpr);
            kw("catch");
            kw("continue");
            kw("debugger");
            kw("default");
            kw("do", {
                isLoop: true
            });
            kw("else", beforeExpr);
            kw("finally");
            kw("for", {
                isLoop: true
            });
            kw("function");
            kw("if");
            kw("return", beforeExpr);
            kw("switch");
            kw("throw", beforeExpr);
            kw("try");
            kw("var");
            kw("let");
            kw("const");
            kw("while", {
                isLoop: true
            });
            kw("with");
            kw("new", {
                beforeExpr: true,
                startsExpr: true
            });
            kw("this", startsExpr);
            kw("super", startsExpr);
            kw("class");
            kw("extends", beforeExpr);
            kw("export");
            kw("import");
            kw("yield", {
                beforeExpr: true,
                startsExpr: true
            });
            kw("null", startsExpr);
            kw("true", startsExpr);
            kw("false", startsExpr);
            kw("in", {
                beforeExpr: true,
                binop: 7
            });
            kw("instanceof", {
                beforeExpr: true,
                binop: 7
            });
            kw("typeof", {
                beforeExpr: true,
                prefix: true,
                startsExpr: true
            });
            kw("void", {
                beforeExpr: true,
                prefix: true,
                startsExpr: true
            });
            kw("delete", {
                beforeExpr: true,
                prefix: true,
                startsExpr: true
            });

        }, {}],
        14: [function(_dereq_, module, exports) {
            "use strict";

            exports.isArray = isArray;

            // Checks if an object has a property.

            exports.has = has;
            Object.defineProperty(exports, "__esModule", {
                value: true
            });

            function isArray(obj) {
                return Object.prototype.toString.call(obj) === "[object Array]";
            }

            function has(obj, propName) {
                return Object.prototype.hasOwnProperty.call(obj, propName);
            }

        }, {}],
        15: [function(_dereq_, module, exports) {
            "use strict";

            exports.isNewLine = isNewLine;
            Object.defineProperty(exports, "__esModule", {
                value: true
            });
            // Matches a whole line break (where CRLF is considered a single
            // line break). Used to count lines.

            var lineBreak = /\r\n?|\n|\u2028|\u2029/;
            exports.lineBreak = lineBreak;
            var lineBreakG = new RegExp(lineBreak.source, "g");

            exports.lineBreakG = lineBreakG;

            function isNewLine(code) {
                return code === 10 || code === 13 || code === 8232 || code == 8233;
            }

            var nonASCIIwhitespace = /[\u1680\u180e\u2000-\u200a\u202f\u205f\u3000\ufeff]/;
            exports.nonASCIIwhitespace = nonASCIIwhitespace;

        }, {}]
    }, {}, [1])(1)
});

//#endregion


//#region acorn/dist/acorn_loose.js

(function(f) {
    if (typeof exports === "object" && typeof module !== "undefined") {
        module.exports = f()
    }
    else if (typeof define === "function" && define.amd) {
        define([], f)
    }
    else {
        var g;
        if (typeof window !== "undefined") {
            g = window
        }
        else if (typeof global !== "undefined") {
            g = global
        }
        else if (typeof self !== "undefined") {
            g = self
        }
        else {
            g = this
        }(g.acorn || (g.acorn = {})).loose = f()
    }
})(function() {
    var define, module, exports;
    return (function e(t, n, r) {
        function s(o, u) {
            if (!n[o]) {
                if (!t[o]) {
                    var a = typeof require == "function" && require;
                    if (!u && a) return a(o, !0);
                    if (i) return i(o, !0);
                    var f = new Error("Cannot find module '" + o + "'");
                    throw f.code = "MODULE_NOT_FOUND", f
                }
                var l = n[o] = {
                    exports: {}
                };
                t[o][0].call(l.exports, function(e) {
                    var n = t[o][1][e];
                    return s(n ? n : e)
                }, l, l.exports, e, t, n, r)
            }
            return n[o].exports
        }
        var i = typeof require == "function" && require;
        for (var o = 0; o < r.length; o++) s(r[o]);
        return s
    })({
        1: [function(_dereq_, module, exports) {
            "use strict";

            var _interopRequireWildcard = function(obj) {
                return obj && obj.__esModule ? obj : {
                    "default": obj
                };
            };

            exports.parse_dammit = parse_dammit;
            Object.defineProperty(exports, "__esModule", {
                value: true
            });
            // Acorn: Loose parser
            //
            // This module provides an alternative parser (`parse_dammit`) that
            // exposes that same interface as `parse`, but will try to parse
            // anything as JavaScript, repairing syntax error the best it can.
            // There are circumstances in which it will raise an error and give
            // up, but they are very rare. The resulting AST will be a mostly
            // valid JavaScript AST (as per the [Mozilla parser API][api], except
            // that:
            //
            // - Return outside functions is allowed
            //
            // - Label consistency (no conflicts, break only to existing labels)
            //   is not enforced.
            //
            // - Bogus Identifier nodes with a name of `"✖"` are inserted whenever
            //   the parser got too confused to return anything meaningful.
            //
            // [api]: https://developer.mozilla.org/en-US/docs/SpiderMonkey/Parser_API
            //
            // The expected use for this is to *first* try `acorn.parse`, and only
            // if that fails switch to `parse_dammit`. The loose parser might
            // parse badly indented code incorrectly, so **don't** use it as
            // your default parser.
            //
            // Quite a lot of acorn.js is duplicated here. The alternative was to
            // add a *lot* of extra cruft to that file, making it less readable
            // and slower. Copying and editing the code allowed me to make
            // invasive changes and simplifications without creating a complicated
            // tangle.

            var acorn = _interopRequireWildcard(_dereq_(".."));

            var _state = _dereq_("./state");

            var LooseParser = _state.LooseParser;

            _dereq_("./tokenize");

            _dereq_("./parseutil");

            _dereq_("./statement");

            _dereq_("./expression");

            exports.LooseParser = _state.LooseParser;

            acorn.defaultOptions.tabSize = 4;

            function parse_dammit(input, options) {
                var p = new LooseParser(input, options);
                p.next();
                return p.parseTopLevel();
            }

            acorn.parse_dammit = parse_dammit;
            acorn.LooseParser = LooseParser;

        }, {
            "..": 2,
            "./expression": 3,
            "./parseutil": 4,
            "./state": 5,
            "./statement": 6,
            "./tokenize": 7
        }],
        2: [function(_dereq_, module, exports) {
            "use strict";

            module.exports = typeof acorn != "undefined" ? acorn : _dereq_("./acorn");

        }, {}],
        3: [function(_dereq_, module, exports) {
            "use strict";

            var LooseParser = _dereq_("./state").LooseParser;

            var isDummy = _dereq_("./parseutil").isDummy;

            var tt = _dereq_("..").tokTypes;

            var lp = LooseParser.prototype;

            lp.checkLVal = function(expr, binding) {
                if (!expr) return expr;
                switch (expr.type) {
                case "Identifier":
                    return expr;

                case "MemberExpression":
                    return binding ? this.dummyIdent() : expr;

                case "ObjectPattern":
                case "ArrayPattern":
                case "RestElement":
                case "AssignmentPattern":
                    if (this.options.ecmaVersion >= 6) return expr;

                default:
                    return this.dummyIdent();
                }
            };

            lp.parseExpression = function(noIn) {
                var start = this.storeCurrentPos();
                var expr = this.parseMaybeAssign(noIn);
                if (this.tok.type === tt.comma) {
                    var node = this.startNodeAt(start);
                    node.expressions = [expr];
                    while (this.eat(tt.comma)) node.expressions.push(this.parseMaybeAssign(noIn));
                    return this.finishNode(node, "SequenceExpression");
                }
                return expr;
            };

            lp.parseParenExpression = function() {
                this.pushCx();
                this.expect(tt.parenL);
                var val = this.parseExpression();
                this.popCx();
                this.expect(tt.parenR);
                return val;
            };

            lp.parseMaybeAssign = function(noIn) {
                var start = this.storeCurrentPos();
                var left = this.parseMaybeConditional(noIn);
                if (this.tok.type.isAssign) {
                    var node = this.startNodeAt(start);
                    node.operator = this.tok.value;
                    node.left = this.tok.type === tt.eq ? this.toAssignable(left) : this.checkLVal(left);
                    this.next();
                    node.right = this.parseMaybeAssign(noIn);
                    return this.finishNode(node, "AssignmentExpression");
                }
                return left;
            };

            lp.parseMaybeConditional = function(noIn) {
                var start = this.storeCurrentPos();
                var expr = this.parseExprOps(noIn);
                if (this.eat(tt.question)) {
                    var node = this.startNodeAt(start);
                    node.test = expr;
                    node.consequent = this.parseMaybeAssign();
                    node.alternate = this.expect(tt.colon) ? this.parseMaybeAssign(noIn) : this.dummyIdent();
                    return this.finishNode(node, "ConditionalExpression");
                }
                return expr;
            };

            lp.parseExprOps = function(noIn) {
                var start = this.storeCurrentPos();
                var indent = this.curIndent,
                    line = this.curLineStart;
                return this.parseExprOp(this.parseMaybeUnary(noIn), start, - 1, noIn, indent, line);
            };

            lp.parseExprOp = function(left, start, minPrec, noIn, indent, line) {
                if (this.curLineStart != line && this.curIndent < indent && this.tokenStartsLine()) return left;
                var prec = this.tok.type.binop;
                if (prec != null && (!noIn || this.tok.type !== tt._in)) {
                    if (prec > minPrec) {
                        var node = this.startNodeAt(start);
                        node.left = left;
                        node.operator = this.tok.value;
                        this.next();
                        if (this.curLineStart != line && this.curIndent < indent && this.tokenStartsLine()) {
                            node.right = this.dummyIdent();
                        }
                        else {
                            var rightStart = this.storeCurrentPos();
                            node.right = this.parseExprOp(this.parseMaybeUnary(noIn), rightStart, prec, noIn, indent, line);
                        }
                        this.finishNode(node, /&&|\|\|/.test(node.operator) ? "LogicalExpression" : "BinaryExpression");
                        return this.parseExprOp(node, start, minPrec, noIn, indent, line);
                    }
                }
                return left;
            };

            lp.parseMaybeUnary = function(noIn) {
                if (this.tok.type.prefix) {
                    var node = this.startNode(),
                        update = this.tok.type === tt.incDec;
                    node.operator = this.tok.value;
                    node.prefix = true;
                    this.next();
                    node.argument = this.parseMaybeUnary(noIn);
                    if (update) node.argument = this.checkLVal(node.argument);
                    return this.finishNode(node, update ? "UpdateExpression" : "UnaryExpression");
                }
                else if (this.tok.type === tt.ellipsis) {
                    var node = this.startNode();
                    this.next();
                    node.argument = this.parseMaybeUnary(noIn);
                    return this.finishNode(node, "SpreadElement");
                }
                var start = this.storeCurrentPos();
                var expr = this.parseExprSubscripts();
                while (this.tok.type.postfix && !this.canInsertSemicolon()) {
                    var node = this.startNodeAt(start);
                    node.operator = this.tok.value;
                    node.prefix = false;
                    node.argument = this.checkLVal(expr);
                    this.next();
                    expr = this.finishNode(node, "UpdateExpression");
                }
                return expr;
            };

            lp.parseExprSubscripts = function() {
                var start = this.storeCurrentPos();
                return this.parseSubscripts(this.parseExprAtom(), start, false, this.curIndent, this.curLineStart);
            };

            lp.parseSubscripts = function(base, start, noCalls, startIndent, line) {
                for (;;) {
                    if (this.curLineStart != line && this.curIndent <= startIndent && this.tokenStartsLine()) {
                        if (this.tok.type == tt.dot && this.curIndent == startIndent)--startIndent;
                        else return base;
                    }

                    if (this.eat(tt.dot)) {
                        var node = this.startNodeAt(start);
                        node.object = base;
                        if (this.curLineStart != line && this.curIndent <= startIndent && this.tokenStartsLine()) node.property = this.dummyIdent();
                        else node.property = this.parsePropertyAccessor() || this.dummyIdent();
                        node.computed = false;
                        base = this.finishNode(node, "MemberExpression");
                    }
                    else if (this.tok.type == tt.bracketL) {
                        this.pushCx();
                        this.next();
                        var node = this.startNodeAt(start);
                        node.object = base;
                        node.property = this.parseExpression();
                        node.computed = true;
                        this.popCx();
                        this.expect(tt.bracketR);
                        base = this.finishNode(node, "MemberExpression");
                    }
                    else if (!noCalls && this.tok.type == tt.parenL) {
                        var node = this.startNodeAt(start);
                        node.callee = base;
                        node.arguments = this.parseExprList(tt.parenR);
                        base = this.finishNode(node, "CallExpression");
                    }
                    else if (this.tok.type == tt.backQuote) {
                        var node = this.startNodeAt(start);
                        node.tag = base;
                        node.quasi = this.parseTemplate();
                        base = this.finishNode(node, "TaggedTemplateExpression");
                    }
                    else {
                        return base;
                    }
                }
            };

            lp.parseExprAtom = function() {
                var node = undefined;
                switch (this.tok.type) {
                case tt._this:
                case tt._super:
                    var type = this.tok.type === tt._this ? "ThisExpression" : "Super";
                    node = this.startNode();
                    this.next();
                    return this.finishNode(node, type);

                case tt.name:
                    var start = this.storeCurrentPos();
                    var id = this.parseIdent();
                    return this.eat(tt.arrow) ? this.parseArrowExpression(this.startNodeAt(start), [id]) : id;

                case tt.regexp:
                    node = this.startNode();
                    var val = this.tok.value;
                    node.regex = {
                        pattern: val.pattern,
                        flags: val.flags
                    };
                    node.value = val.value;
                    node.raw = this.input.slice(this.tok.start, this.tok.end);
                    this.next();
                    return this.finishNode(node, "Literal");

                case tt.num:
                case tt.string:
                    node = this.startNode();
                    node.value = this.tok.value;
                    node.raw = this.input.slice(this.tok.start, this.tok.end);
                    this.next();
                    return this.finishNode(node, "Literal");

                case tt._null:
                case tt._true:
                case tt._false:
                    node = this.startNode();
                    node.value = this.tok.type === tt._null ? null : this.tok.type === tt._true;
                    node.raw = this.tok.type.keyword;
                    this.next();
                    return this.finishNode(node, "Literal");

                case tt.parenL:
                    var parenStart = this.storeCurrentPos();
                    this.next();
                    var inner = this.parseExpression();
                    this.expect(tt.parenR);
                    if (this.eat(tt.arrow)) {
                        return this.parseArrowExpression(this.startNodeAt(parenStart), inner.expressions || (isDummy(inner) ? [] : [inner]));
                    }
                    if (this.options.preserveParens) {
                        var par = this.startNodeAt(parenStart);
                        par.expression = inner;
                        inner = this.finishNode(par, "ParenthesizedExpression");
                    }
                    return inner;

                case tt.bracketL:
                    node = this.startNode();
                    node.elements = this.parseExprList(tt.bracketR, true);
                    return this.finishNode(node, "ArrayExpression");

                case tt.braceL:
                    return this.parseObj();

                case tt._class:
                    return this.parseClass();

                case tt._function:
                    node = this.startNode();
                    this.next();
                    return this.parseFunction(node, false);

                case tt._new:
                    return this.parseNew();

                case tt._yield:
                    node = this.startNode();
                    this.next();
                    if (this.semicolon() || this.canInsertSemicolon() || this.tok.type != tt.star && !this.tok.type.startsExpr) {
                        node.delegate = false;
                        node.argument = null;
                    }
                    else {
                        node.delegate = this.eat(tt.star);
                        node.argument = this.parseMaybeAssign();
                    }
                    return this.finishNode(node, "YieldExpression");

                case tt.backQuote:
                    return this.parseTemplate();

                default:
                    return this.dummyIdent();
                }
            };

            lp.parseNew = function() {
                var node = this.startNode(),
                    startIndent = this.curIndent,
                    line = this.curLineStart;
                var meta = this.parseIdent(true);
                if (this.options.ecmaVersion >= 6 && this.eat(tt.dot)) {
                    node.meta = meta;
                    node.property = this.parseIdent(true);
                    return this.finishNode(node, "MetaProperty");
                }
                var start = this.storeCurrentPos();
                node.callee = this.parseSubscripts(this.parseExprAtom(), start, true, startIndent, line);
                if (this.tok.type == tt.parenL) {
                    node.arguments = this.parseExprList(tt.parenR);
                }
                else {
                    node.arguments = [];
                }
                return this.finishNode(node, "NewExpression");
            };

            lp.parseTemplateElement = function() {
                var elem = this.startNode();
                elem.value = {
                    raw: this.input.slice(this.tok.start, this.tok.end),
                    cooked: this.tok.value
                };
                this.next();
                elem.tail = this.tok.type === tt.backQuote;
                return this.finishNode(elem, "TemplateElement");
            };

            lp.parseTemplate = function() {
                var node = this.startNode();
                this.next();
                node.expressions = [];
                var curElt = this.parseTemplateElement();
                node.quasis = [curElt];
                while (!curElt.tail) {
                    this.next();
                    node.expressions.push(this.parseExpression());
                    if (this.expect(tt.braceR)) {
                        curElt = this.parseTemplateElement();
                    }
                    else {
                        curElt = this.startNode();
                        curElt.value = {
                            cooked: "",
                            raw: ""
                        };
                        curElt.tail = true;
                    }
                    node.quasis.push(curElt);
                }
                this.expect(tt.backQuote);
                return this.finishNode(node, "TemplateLiteral");
            };

            lp.parseObj = function() {
                var node = this.startNode();
                node.properties = [];
                this.pushCx();
                var indent = this.curIndent + 1,
                    line = this.curLineStart;
                this.eat(tt.braceL);
                if (this.curIndent + 1 < indent) {
                    indent = this.curIndent;
                    line = this.curLineStart;
                }
                while (!this.closes(tt.braceR, indent, line)) {
                    var prop = this.startNode(),
                        isGenerator = undefined,
                        start = undefined;
                    if (this.options.ecmaVersion >= 6) {
                        start = this.storeCurrentPos();
                        prop.method = false;
                        prop.shorthand = false;
                        isGenerator = this.eat(tt.star);
                    }
                    this.parsePropertyName(prop);
                    if (isDummy(prop.key)) {
                        if (isDummy(this.parseMaybeAssign())) this.next();
                        this.eat(tt.comma);
                        continue;
                    }
                    if (this.eat(tt.colon)) {
                        prop.kind = "init";
                        prop.value = this.parseMaybeAssign();
                    }
                    else if (this.options.ecmaVersion >= 6 && (this.tok.type === tt.parenL || this.tok.type === tt.braceL)) {
                        prop.kind = "init";
                        prop.method = true;
                        prop.value = this.parseMethod(isGenerator);
                    }
                    else if (this.options.ecmaVersion >= 5 && prop.key.type === "Identifier" && !prop.computed && (prop.key.name === "get" || prop.key.name === "set") && (this.tok.type != tt.comma && this.tok.type != tt.braceR)) {
                        prop.kind = prop.key.name;
                        this.parsePropertyName(prop);
                        prop.value = this.parseMethod(false);
                    }
                    else {
                        prop.kind = "init";
                        if (this.options.ecmaVersion >= 6) {
                            if (this.eat(tt.eq)) {
                                var assign = this.startNodeAt(start);
                                assign.operator = "=";
                                assign.left = prop.key;
                                assign.right = this.parseMaybeAssign();
                                prop.value = this.finishNode(assign, "AssignmentExpression");
                            }
                            else {
                                prop.value = prop.key;
                            }
                        }
                        else {
                            prop.value = this.dummyIdent();
                        }
                        prop.shorthand = true;
                    }
                    node.properties.push(this.finishNode(prop, "Property"));
                    this.eat(tt.comma);
                }
                this.popCx();
                if (!this.eat(tt.braceR)) {
                    // If there is no closing brace, make the node span to the start
                    // of the next token (this is useful for Tern)
                    this.last.end = this.tok.start;
                    if (this.options.locations) this.last.loc.end = this.tok.loc.start;
                }
                return this.finishNode(node, "ObjectExpression");
            };

            lp.parsePropertyName = function(prop) {
                if (this.options.ecmaVersion >= 6) {
                    if (this.eat(tt.bracketL)) {
                        prop.computed = true;
                        prop.key = this.parseExpression();
                        this.expect(tt.bracketR);
                        return;
                    }
                    else {
                        prop.computed = false;
                    }
                }
                var key = this.tok.type === tt.num || this.tok.type === tt.string ? this.parseExprAtom() : this.parseIdent();
                prop.key = key || this.dummyIdent();
            };

            lp.parsePropertyAccessor = function() {
                if (this.tok.type === tt.name || this.tok.type.keyword) return this.parseIdent();
            };

            lp.parseIdent = function() {
                var name = this.tok.type === tt.name ? this.tok.value : this.tok.type.keyword;
                if (!name) return this.dummyIdent();
                var node = this.startNode();
                this.next();
                node.name = name;
                return this.finishNode(node, "Identifier");
            };

            lp.initFunction = function(node) {
                node.id = null;
                node.params = [];
                if (this.options.ecmaVersion >= 6) {
                    node.generator = false;
                    node.expression = false;
                }
            };

            // Convert existing expression atom to assignable pattern
            // if possible.

            lp.toAssignable = function(node, binding) {
                if (this.options.ecmaVersion >= 6 && node) {
                    switch (node.type) {
                    case "ObjectExpression":
                        node.type = "ObjectPattern";
                        var props = node.properties;
                        for (var i = 0; i < props.length; i++) {
                            this.toAssignable(props[i].value, binding);
                        }
                        break;

                    case "ArrayExpression":
                        node.type = "ArrayPattern";
                        this.toAssignableList(node.elements, binding);
                        break;

                    case "SpreadElement":
                        node.type = "RestElement";
                        node.argument = this.toAssignable(node.argument, binding);
                        break;

                    case "AssignmentExpression":
                        node.type = "AssignmentPattern";
                        break;
                    }
                }
                return this.checkLVal(node, binding);
            };

            lp.toAssignableList = function(exprList, binding) {
                for (var i = 0; i < exprList.length; i++) {
                    exprList[i] = this.toAssignable(exprList[i], binding);
                }
                return exprList;
            };

            lp.parseFunctionParams = function(params) {
                params = this.parseExprList(tt.parenR);
                return this.toAssignableList(params, true);
            };

            lp.parseMethod = function(isGenerator) {
                var node = this.startNode();
                this.initFunction(node);
                node.params = this.parseFunctionParams();
                node.generator = isGenerator || false;
                node.expression = this.options.ecmaVersion >= 6 && this.tok.type !== tt.braceL;
                node.body = node.expression ? this.parseMaybeAssign() : this.parseBlock();
                return this.finishNode(node, "FunctionExpression");
            };

            lp.parseArrowExpression = function(node, params) {
                this.initFunction(node);
                node.params = this.toAssignableList(params, true);
                node.expression = this.tok.type !== tt.braceL;
                node.body = node.expression ? this.parseMaybeAssign() : this.parseBlock();
                return this.finishNode(node, "ArrowFunctionExpression");
            };

            lp.parseExprList = function(close, allowEmpty) {
                this.pushCx();
                var indent = this.curIndent,
                    line = this.curLineStart,
                    elts = [];
                this.next(); // Opening bracket
                while (!this.closes(close, indent + 1, line)) {
                    if (this.eat(tt.comma)) {
                        elts.push(allowEmpty ? null : this.dummyIdent());
                        continue;
                    }
                    var elt = this.parseMaybeAssign();
                    if (isDummy(elt)) {
                        if (this.closes(close, indent, line)) break;
                        this.next();
                    }
                    else {
                        elts.push(elt);
                    }
                    this.eat(tt.comma);
                }
                this.popCx();
                if (!this.eat(close)) {
                    // If there is no closing brace, make the node span to the start
                    // of the next token (this is useful for Tern)
                    this.last.end = this.tok.start;
                    if (this.options.locations) this.last.loc.end = this.tok.loc.start;
                }
                return elts;
            };

        }, {
            "..": 2,
            "./parseutil": 4,
            "./state": 5
        }],
        4: [function(_dereq_, module, exports) {
            "use strict";

            exports.isDummy = isDummy;
            Object.defineProperty(exports, "__esModule", {
                value: true
            });

            var LooseParser = _dereq_("./state").LooseParser;

            var _ = _dereq_("..");

            var Node = _.Node;
            var SourceLocation = _.SourceLocation;
            var lineBreak = _.lineBreak;
            var isNewLine = _.isNewLine;
            var tt = _.tokTypes;

            var lp = LooseParser.prototype;

            lp.startNode = function() {
                var node = new Node();
                node.start = this.tok.start;
                if (this.options.locations) node.loc = new SourceLocation(this.toks, this.tok.loc.start);
                if (this.options.directSourceFile) node.sourceFile = this.options.directSourceFile;
                if (this.options.ranges) node.range = [this.tok.start, 0];
                return node;
            };

            lp.storeCurrentPos = function() {
                return this.options.locations ? [this.tok.start, this.tok.loc.start] : this.tok.start;
            };

            lp.startNodeAt = function(pos) {
                var node = new Node();
                if (this.options.locations) {
                    node.start = pos[0];
                    node.loc = new SourceLocation(this.toks, pos[1]);
                    pos = pos[0];
                }
                else {
                    node.start = pos;
                }
                if (this.options.directSourceFile) node.sourceFile = this.options.directSourceFile;
                if (this.options.ranges) node.range = [pos, 0];
                return node;
            };

            lp.finishNode = function(node, type) {
                node.type = type;
                node.end = this.last.end;
                if (this.options.locations) node.loc.end = this.last.loc.end;
                if (this.options.ranges) node.range[1] = this.last.end;
                return node;
            };

            lp.dummyIdent = function() {
                var dummy = this.startNode();
                dummy.name = "✖";
                return this.finishNode(dummy, "Identifier");
            };

            function isDummy(node) {
                return node.name == "✖";
            }

            lp.eat = function(type) {
                if (this.tok.type === type) {
                    this.next();
                    return true;
                }
                else {
                    return false;
                }
            };

            lp.isContextual = function(name) {
                return this.tok.type === tt.name && this.tok.value === name;
            };

            lp.eatContextual = function(name) {
                return this.tok.value === name && this.eat(tt.name);
            };

            lp.canInsertSemicolon = function() {
                return this.tok.type === tt.eof || this.tok.type === tt.braceR || lineBreak.test(this.input.slice(this.last.end, this.tok.start));
            };

            lp.semicolon = function() {
                return this.eat(tt.semi);
            };

            lp.expect = function(type) {
                if (this.eat(type)) return true;
                for (var i = 1; i <= 2; i++) {
                    if (this.lookAhead(i).type == type) {
                        for (var j = 0; j < i; j++) {
                            this.next();
                        }
                        return true;
                    }
                }
            };

            lp.pushCx = function() {
                this.context.push(this.curIndent);
            };
            lp.popCx = function() {
                this.curIndent = this.context.pop();
            };

            lp.lineEnd = function(pos) {
                while (pos < this.input.length && !isNewLine(this.input.charCodeAt(pos)))++pos;
                return pos;
            };

            lp.indentationAfter = function(pos) {
                for (var count = 0;; ++pos) {
                    var ch = this.input.charCodeAt(pos);
                    if (ch === 32)++count;
                    else if (ch === 9) count += this.options.tabSize;
                    else return count;
                }
            };

            lp.closes = function(closeTok, indent, line, blockHeuristic) {
                if (this.tok.type === closeTok || this.tok.type === tt.eof) return true;
                return line != this.curLineStart && this.curIndent < indent && this.tokenStartsLine() && (!blockHeuristic || this.nextLineStart >= this.input.length || this.indentationAfter(this.nextLineStart) < indent);
            };

            lp.tokenStartsLine = function() {
                for (var p = this.tok.start - 1; p >= this.curLineStart; --p) {
                    var ch = this.input.charCodeAt(p);
                    if (ch !== 9 && ch !== 32) return false;
                }
                return true;
            };

        }, {
            "..": 2,
            "./state": 5
        }],
        5: [function(_dereq_, module, exports) {
            "use strict";

            exports.LooseParser = LooseParser;
            Object.defineProperty(exports, "__esModule", {
                value: true
            });

            var _ = _dereq_("..");

            var tokenizer = _.tokenizer;
            var SourceLocation = _.SourceLocation;
            var tt = _.tokTypes;

            function LooseParser(input, options) {
                this.toks = tokenizer(input, options);
                this.options = this.toks.options;
                this.input = this.toks.input;
                this.tok = this.last = {
                    type: tt.eof,
                    start: 0,
                    end: 0
                };
                if (this.options.locations) {
                    var here = this.toks.curPosition();
                    this.tok.loc = new SourceLocation(this.toks, here, here);
                }
                this.ahead = []; // Tokens ahead
                this.context = []; // Indentation contexted
                this.curIndent = 0;
                this.curLineStart = 0;
                this.nextLineStart = this.lineEnd(this.curLineStart) + 1;
            }

        }, {
            "..": 2
        }],
        6: [function(_dereq_, module, exports) {
            "use strict";

            var LooseParser = _dereq_("./state").LooseParser;

            var isDummy = _dereq_("./parseutil").isDummy;

            var _ = _dereq_("..");

            var getLineInfo = _.getLineInfo;
            var tt = _.tokTypes;

            var lp = LooseParser.prototype;

            lp.parseTopLevel = function() {
                var node = this.startNodeAt(this.options.locations ? [0, getLineInfo(this.input, 0)] : 0);
                node.body = [];
                while (this.tok.type !== tt.eof) node.body.push(this.parseStatement());
                this.last = this.tok;
                if (this.options.ecmaVersion >= 6) {
                    node.sourceType = this.options.sourceType;
                }
                return this.finishNode(node, "Program");
            };

            lp.parseStatement = function() {
                var starttype = this.tok.type,
                    node = this.startNode();

                switch (starttype) {
                case tt._break:
                case tt._continue:
                    this.next();
                    var isBreak = starttype === tt._break;
                    if (this.semicolon() || this.canInsertSemicolon()) {
                        node.label = null;
                    }
                    else {
                        node.label = this.tok.type === tt.name ? this.parseIdent() : null;
                        this.semicolon();
                    }
                    return this.finishNode(node, isBreak ? "BreakStatement" : "ContinueStatement");

                case tt._debugger:
                    this.next();
                    this.semicolon();
                    return this.finishNode(node, "DebuggerStatement");

                case tt._do:
                    this.next();
                    node.body = this.parseStatement();
                    node.test = this.eat(tt._while) ? this.parseParenExpression() : this.dummyIdent();
                    this.semicolon();
                    return this.finishNode(node, "DoWhileStatement");

                case tt._for:
                    this.next();
                    this.pushCx();
                    this.expect(tt.parenL);
                    if (this.tok.type === tt.semi) return this.parseFor(node, null);
                    if (this.tok.type === tt._var || this.tok.type === tt._let || this.tok.type === tt._const) {
                        var _init = this.parseVar(true);
                        if (_init.declarations.length === 1 && (this.tok.type === tt._in || this.isContextual("of"))) {
                            return this.parseForIn(node, _init);
                        }
                        return this.parseFor(node, _init);
                    }
                    var init = this.parseExpression(true);
                    if (this.tok.type === tt._in || this.isContextual("of")) return this.parseForIn(node, this.toAssignable(init));
                    return this.parseFor(node, init);

                case tt._function:
                    this.next();
                    return this.parseFunction(node, true);

                case tt._if:
                    this.next();
                    node.test = this.parseParenExpression();
                    node.consequent = this.parseStatement();
                    node.alternate = this.eat(tt._else) ? this.parseStatement() : null;
                    return this.finishNode(node, "IfStatement");

                case tt._return:
                    this.next();
                    if (this.eat(tt.semi) || this.canInsertSemicolon()) node.argument = null;
                    else {
                        node.argument = this.parseExpression();
                        this.semicolon();
                    }
                    return this.finishNode(node, "ReturnStatement");

                case tt._switch:
                    var blockIndent = this.curIndent,
                        line = this.curLineStart;
                    this.next();
                    node.discriminant = this.parseParenExpression();
                    node.cases = [];
                    this.pushCx();
                    this.expect(tt.braceL);

                    var cur = undefined;
                    while (!this.closes(tt.braceR, blockIndent, line, true)) {
                        if (this.tok.type === tt._case || this.tok.type === tt._default) {
                            var isCase = this.tok.type === tt._case;
                            if (cur) this.finishNode(cur, "SwitchCase");
                            node.cases.push(cur = this.startNode());
                            cur.consequent = [];
                            this.next();
                            if (isCase) cur.test = this.parseExpression();
                            else cur.test = null;
                            this.expect(tt.colon);
                        }
                        else {
                            if (!cur) {
                                node.cases.push(cur = this.startNode());
                                cur.consequent = [];
                                cur.test = null;
                            }
                            cur.consequent.push(this.parseStatement());
                        }
                    }
                    if (cur) this.finishNode(cur, "SwitchCase");
                    this.popCx();
                    this.eat(tt.braceR);
                    return this.finishNode(node, "SwitchStatement");

                case tt._throw:
                    this.next();
                    node.argument = this.parseExpression();
                    this.semicolon();
                    return this.finishNode(node, "ThrowStatement");

                case tt._try:
                    this.next();
                    node.block = this.parseBlock();
                    node.handler = null;
                    if (this.tok.type === tt._catch) {
                        var clause = this.startNode();
                        this.next();
                        this.expect(tt.parenL);
                        clause.param = this.toAssignable(this.parseExprAtom(), true);
                        this.expect(tt.parenR);
                        clause.guard = null;
                        clause.body = this.parseBlock();
                        node.handler = this.finishNode(clause, "CatchClause");
                    }
                    node.finalizer = this.eat(tt._finally) ? this.parseBlock() : null;
                    if (!node.handler && !node.finalizer) return node.block;
                    return this.finishNode(node, "TryStatement");

                case tt._var:
                case tt._let:
                case tt._const:
                    return this.parseVar();

                case tt._while:
                    this.next();
                    node.test = this.parseParenExpression();
                    node.body = this.parseStatement();
                    return this.finishNode(node, "WhileStatement");

                case tt._with:
                    this.next();
                    node.object = this.parseParenExpression();
                    node.body = this.parseStatement();
                    return this.finishNode(node, "WithStatement");

                case tt.braceL:
                    return this.parseBlock();

                case tt.semi:
                    this.next();
                    return this.finishNode(node, "EmptyStatement");

                case tt._class:
                    return this.parseClass(true);

                case tt._import:
                    return this.parseImport();

                case tt._export:
                    return this.parseExport();

                default:
                    var expr = this.parseExpression();
                    if (isDummy(expr)) {
                        this.next();
                        if (this.tok.type === tt.eof) return this.finishNode(node, "EmptyStatement");
                        return this.parseStatement();
                    }
                    else if (starttype === tt.name && expr.type === "Identifier" && this.eat(tt.colon)) {
                        node.body = this.parseStatement();
                        node.label = expr;
                        return this.finishNode(node, "LabeledStatement");
                    }
                    else {
                        node.expression = expr;
                        this.semicolon();
                        return this.finishNode(node, "ExpressionStatement");
                    }
                }
            };

            lp.parseBlock = function() {
                var node = this.startNode();
                this.pushCx();
                this.expect(tt.braceL);
                var blockIndent = this.curIndent,
                    line = this.curLineStart;
                node.body = [];
                while (!this.closes(tt.braceR, blockIndent, line, true)) node.body.push(this.parseStatement());
                this.popCx();
                this.eat(tt.braceR);
                return this.finishNode(node, "BlockStatement");
            };

            lp.parseFor = function(node, init) {
                node.init = init;
                node.test = node.update = null;
                if (this.eat(tt.semi) && this.tok.type !== tt.semi) node.test = this.parseExpression();
                if (this.eat(tt.semi) && this.tok.type !== tt.parenR) node.update = this.parseExpression();
                this.popCx();
                this.expect(tt.parenR);
                node.body = this.parseStatement();
                return this.finishNode(node, "ForStatement");
            };

            lp.parseForIn = function(node, init) {
                var type = this.tok.type === tt._in ? "ForInStatement" : "ForOfStatement";
                this.next();
                node.left = init;
                node.right = this.parseExpression();
                this.popCx();
                this.expect(tt.parenR);
                node.body = this.parseStatement();
                return this.finishNode(node, type);
            };

            lp.parseVar = function(noIn) {
                var node = this.startNode();
                node.kind = this.tok.type.keyword;
                this.next();
                node.declarations = [];
                do {
                    var decl = this.startNode();
                    decl.id = this.options.ecmaVersion >= 6 ? this.toAssignable(this.parseExprAtom(), true) : this.parseIdent();
                    decl.init = this.eat(tt.eq) ? this.parseMaybeAssign(noIn) : null;
                    node.declarations.push(this.finishNode(decl, "VariableDeclarator"));
                } while (this.eat(tt.comma));
                if (!node.declarations.length) {
                    var decl = this.startNode();
                    decl.id = this.dummyIdent();
                    node.declarations.push(this.finishNode(decl, "VariableDeclarator"));
                }
                if (!noIn) this.semicolon();
                return this.finishNode(node, "VariableDeclaration");
            };

            lp.parseClass = function(isStatement) {
                var node = this.startNode();
                this.next();
                if (this.tok.type === tt.name) node.id = this.parseIdent();
                else if (isStatement) node.id = this.dummyIdent();
                else node.id = null;
                node.superClass = this.eat(tt._extends) ? this.parseExpression() : null;
                node.body = this.startNode();
                node.body.body = [];
                this.pushCx();
                var indent = this.curIndent + 1,
                    line = this.curLineStart;
                this.eat(tt.braceL);
                if (this.curIndent + 1 < indent) {
                    indent = this.curIndent;
                    line = this.curLineStart;
                }
                while (!this.closes(tt.braceR, indent, line)) {
                    if (this.semicolon()) continue;
                    var method = this.startNode(),
                        isGenerator = undefined,
                        start = undefined;
                    if (this.options.ecmaVersion >= 6) {
                        method["static"] = false;
                        isGenerator = this.eat(tt.star);
                    }
                    this.parsePropertyName(method);
                    if (isDummy(method.key)) {
                        if (isDummy(this.parseMaybeAssign())) this.next();
                        this.eat(tt.comma);
                        continue;
                    }
                    if (method.key.type === "Identifier" && !method.computed && method.key.name === "static" && (this.tok.type != tt.parenL && this.tok.type != tt.braceL)) {
                        method["static"] = true;
                        isGenerator = this.eat(tt.star);
                        this.parsePropertyName(method);
                    }
                    else {
                        method["static"] = false;
                    }
                    if (this.options.ecmaVersion >= 5 && method.key.type === "Identifier" && !method.computed && (method.key.name === "get" || method.key.name === "set") && this.tok.type !== tt.parenL && this.tok.type !== tt.braceL) {
                        method.kind = method.key.name;
                        this.parsePropertyName(method);
                        method.value = this.parseMethod(false);
                    }
                    else {
                        if (!method.computed && !method["static"] && !isGenerator && (method.key.type === "Identifier" && method.key.name === "constructor" || method.key.type === "Literal" && method.key.value === "constructor")) {
                            method.kind = "constructor";
                        }
                        else {
                            method.kind = "method";
                        }
                        method.value = this.parseMethod(isGenerator);
                    }
                    node.body.body.push(this.finishNode(method, "MethodDefinition"));
                }
                this.popCx();
                if (!this.eat(tt.braceR)) {
                    // If there is no closing brace, make the node span to the start
                    // of the next token (this is useful for Tern)
                    this.last.end = this.tok.start;
                    if (this.options.locations) this.last.loc.end = this.tok.loc.start;
                }
                this.semicolon();
                this.finishNode(node.body, "ClassBody");
                return this.finishNode(node, isStatement ? "ClassDeclaration" : "ClassExpression");
            };

            lp.parseFunction = function(node, isStatement) {
                this.initFunction(node);
                if (this.options.ecmaVersion >= 6) {
                    node.generator = this.eat(tt.star);
                }
                if (this.tok.type === tt.name) node.id = this.parseIdent();
                else if (isStatement) node.id = this.dummyIdent();
                node.params = this.parseFunctionParams();
                node.body = this.parseBlock();
                return this.finishNode(node, isStatement ? "FunctionDeclaration" : "FunctionExpression");
            };

            lp.parseExport = function() {
                var node = this.startNode();
                this.next();
                if (this.eat(tt.star)) {
                    node.source = this.eatContextual("from") ? this.parseExprAtom() : null;
                    return this.finishNode(node, "ExportAllDeclaration");
                }
                if (this.eat(tt._default)) {
                    var expr = this.parseMaybeAssign();
                    if (expr.id) {
                        switch (expr.type) {
                        case "FunctionExpression":
                            expr.type = "FunctionDeclaration";
                            break;
                        case "ClassExpression":
                            expr.type = "ClassDeclaration";
                            break;
                        }
                    }
                    node.declaration = expr;
                    this.semicolon();
                    return this.finishNode(node, "ExportDefaultDeclaration");
                }
                if (this.tok.type.keyword) {
                    node.declaration = this.parseStatement();
                    node.specifiers = [];
                    node.source = null;
                }
                else {
                    node.declaration = null;
                    node.specifiers = this.parseExportSpecifierList();
                    node.source = this.eatContextual("from") ? this.parseExprAtom() : null;
                    this.semicolon();
                }
                return this.finishNode(node, "ExportNamedDeclaration");
            };

            lp.parseImport = function() {
                var node = this.startNode();
                this.next();
                if (this.tok.type === tt.string) {
                    node.specifiers = [];
                    node.source = this.parseExprAtom();
                    node.kind = "";
                }
                else {
                    var elt = undefined;
                    if (this.tok.type === tt.name && this.tok.value !== "from") {
                        elt = this.startNode();
                        elt.local = this.parseIdent();
                        this.finishNode(elt, "ImportDefaultSpecifier");
                        this.eat(tt.comma);
                    }
                    node.specifiers = this.parseImportSpecifierList();
                    node.source = this.eatContextual("from") ? this.parseExprAtom() : null;
                    if (elt) node.specifiers.unshift(elt);
                }
                this.semicolon();
                return this.finishNode(node, "ImportDeclaration");
            };

            lp.parseImportSpecifierList = function() {
                var elts = [];
                if (this.tok.type === tt.star) {
                    var elt = this.startNode();
                    this.next();
                    if (this.eatContextual("as")) elt.local = this.parseIdent();
                    elts.push(this.finishNode(elt, "ImportNamespaceSpecifier"));
                }
                else {
                    var indent = this.curIndent,
                        line = this.curLineStart,
                        continuedLine = this.nextLineStart;
                    this.pushCx();
                    this.eat(tt.braceL);
                    if (this.curLineStart > continuedLine) continuedLine = this.curLineStart;
                    while (!this.closes(tt.braceR, indent + (this.curLineStart <= continuedLine ? 1 : 0), line)) {
                        var elt = this.startNode();
                        if (this.eat(tt.star)) {
                            if (this.eatContextual("as")) elt.local = this.parseIdent();
                            this.finishNode(elt, "ImportNamespaceSpecifier");
                        }
                        else {
                            if (this.isContextual("from")) break;
                            elt.imported = this.parseIdent();
                            elt.local = this.eatContextual("as") ? this.parseIdent() : elt.imported;
                            this.finishNode(elt, "ImportSpecifier");
                        }
                        elts.push(elt);
                        this.eat(tt.comma);
                    }
                    this.eat(tt.braceR);
                    this.popCx();
                }
                return elts;
            };

            lp.parseExportSpecifierList = function() {
                var elts = [];
                var indent = this.curIndent,
                    line = this.curLineStart,
                    continuedLine = this.nextLineStart;
                this.pushCx();
                this.eat(tt.braceL);
                if (this.curLineStart > continuedLine) continuedLine = this.curLineStart;
                while (!this.closes(tt.braceR, indent + (this.curLineStart <= continuedLine ? 1 : 0), line)) {
                    if (this.isContextual("from")) break;
                    var elt = this.startNode();
                    elt.local = this.parseIdent();
                    elt.exported = this.eatContextual("as") ? this.parseIdent() : elt.local;
                    this.finishNode(elt, "ExportSpecifier");
                    elts.push(elt);
                    this.eat(tt.comma);
                }
                this.eat(tt.braceR);
                this.popCx();
                return elts;
            };

        }, {
            "..": 2,
            "./parseutil": 4,
            "./state": 5
        }],
        7: [function(_dereq_, module, exports) {
            "use strict";

            var _ = _dereq_("..");

            var tt = _.tokTypes;
            var Token = _.Token;
            var isNewLine = _.isNewLine;
            var SourceLocation = _.SourceLocation;
            var getLineInfo = _.getLineInfo;
            var lineBreakG = _.lineBreakG;

            var LooseParser = _dereq_("./state").LooseParser;

            var lp = LooseParser.prototype;

            function isSpace(ch) {
                return ch < 14 && ch > 8 || ch === 32 || ch === 160 || isNewLine(ch);
            }

            lp.next = function() {
                this.last = this.tok;
                if (this.ahead.length) this.tok = this.ahead.shift();
                else this.tok = this.readToken();

                if (this.tok.start >= this.nextLineStart) {
                    while (this.tok.start >= this.nextLineStart) {
                        this.curLineStart = this.nextLineStart;
                        this.nextLineStart = this.lineEnd(this.curLineStart) + 1;
                    }
                    this.curIndent = this.indentationAfter(this.curLineStart);
                }
            };

            lp.readToken = function() {
                for (;;) {
                    try {
                        this.toks.next();
                        if (this.toks.type === tt.dot && this.input.substr(this.toks.end, 1) === "." && this.options.ecmaVersion >= 6) {
                            this.toks.end++;
                            this.toks.type = tt.ellipsis;
                        }
                        return new Token(this.toks);
                    }
                    catch (e) {
                        if (!(e instanceof SyntaxError)) throw e;

                        // Try to skip some text, based on the error message, and then continue
                        var msg = e.message,
                            pos = e.raisedAt,
                            replace = true;
                        if (/unterminated/i.test(msg)) {
                            pos = this.lineEnd(e.pos + 1);
                            if (/string/.test(msg)) {
                                replace = {
                                    start: e.pos,
                                    end: pos,
                                    type: tt.string,
                                    value: this.input.slice(e.pos + 1, pos)
                                };
                            }
                            else if (/regular expr/i.test(msg)) {
                                var re = this.input.slice(e.pos, pos);
                                try {
                                    re = new RegExp(re);
                                }
                                catch (e) {}
                                replace = {
                                    start: e.pos,
                                    end: pos,
                                    type: tt.regexp,
                                    value: re
                                };
                            }
                            else if (/template/.test(msg)) {
                                replace = {
                                    start: e.pos,
                                    end: pos,
                                    type: tt.template,
                                    value: this.input.slice(e.pos, pos)
                                };
                            }
                            else {
                                replace = false;
                            }
                        }
                        else if (/invalid (unicode|regexp|number)|expecting unicode|octal literal|is reserved|directly after number/i.test(msg)) {
                            while (pos < this.input.length && !isSpace(this.input.charCodeAt(pos)))++pos;
                        }
                        else if (/character escape|expected hexadecimal/i.test(msg)) {
                            while (pos < this.input.length) {
                                var ch = this.input.charCodeAt(pos++);
                                if (ch === 34 || ch === 39 || isNewLine(ch)) break;
                            }
                        }
                        else if (/unexpected character/i.test(msg)) {
                            pos++;
                            replace = false;
                        }
                        else if (/regular expression/i.test(msg)) {
                            replace = true;
                        }
                        else {
                            throw e;
                        }
                        this.resetTo(pos);
                        if (replace === true) replace = {
                            start: pos,
                            end: pos,
                            type: tt.name,
                            value: "✖"
                        };
                        if (replace) {
                            if (this.options.locations) replace.loc = new SourceLocation(this.toks, getLineInfo(this.input, replace.start), getLineInfo(this.input, replace.end));
                            return replace;
                        }
                    }
                }
            };

            lp.resetTo = function(pos) {
                this.toks.pos = pos;
                var ch = this.input.charAt(pos - 1);
                this.toks.exprAllowed = !ch || /[\[\{\(,;:?\/*=+\-~!|&%^<>]/.test(ch) || /[enwfd]/.test(ch) && /\b(keywords|case|else|return|throw|new|in|(instance|type)of|delete|void)$/.test(this.input.slice(pos - 10, pos));

                if (this.options.locations) {
                    this.toks.curLine = 1;
                    this.toks.lineStart = lineBreakG.lastIndex = 0;
                    var match = undefined;
                    while ((match = lineBreakG.exec(this.input)) && match.index < pos) {
                        ++this.toks.curLine;
                        this.toks.lineStart = match.index + match[0].length;
                    }
                }
            };

            lp.lookAhead = function(n) {
                while (n > this.ahead.length) this.ahead.push(this.readToken());
                return this.ahead[n - 1];
            };

        }, {
            "..": 2,
            "./state": 5
        }]
    }, {}, [1])(1)
});

//#endregion


//#region acorn/dist/walk.js

(function(f) {
    if (typeof exports === "object" && typeof module !== "undefined") {
        module.exports = f()
    }
    else if (typeof define === "function" && define.amd) {
        define([], f)
    }
    else {
        var g;
        if (typeof window !== "undefined") {
            g = window
        }
        else if (typeof global !== "undefined") {
            g = global
        }
        else if (typeof self !== "undefined") {
            g = self
        }
        else {
            g = this
        }(g.acorn || (g.acorn = {})).walk = f()
    }
})(function() {
    var define, module, exports;
    return (function e(t, n, r) {
        function s(o, u) {
            if (!n[o]) {
                if (!t[o]) {
                    var a = typeof require == "function" && require;
                    if (!u && a) return a(o, !0);
                    if (i) return i(o, !0);
                    var f = new Error("Cannot find module '" + o + "'");
                    throw f.code = "MODULE_NOT_FOUND", f
                }
                var l = n[o] = {
                    exports: {}
                };
                t[o][0].call(l.exports, function(e) {
                    var n = t[o][1][e];
                    return s(n ? n : e)
                }, l, l.exports, e, t, n, r)
            }
            return n[o].exports
        }
        var i = typeof require == "function" && require;
        for (var o = 0; o < r.length; o++) s(r[o]);
        return s
    })({
        1: [function(_dereq_, module, exports) {
            "use strict";

            var _classCallCheck = function(instance, Constructor) {
                if (!(instance instanceof Constructor)) {
                    throw new TypeError("Cannot call a class as a function");
                }
            };

            // AST walker module for Mozilla Parser API compatible trees

            // A simple walk is one where you simply specify callbacks to be
            // called on specific nodes. The last two arguments are optional. A
            // simple use would be
            //
            //     walk.simple(myTree, {
            //         Expression: function(node) { ... }
            //     });
            //
            // to do something with all expressions. All Parser API node types
            // can be used to identify node types, as well as Expression,
            // Statement, and ScopeBody, which denote categories of nodes.
            //
            // The base argument can be used to pass a custom (recursive)
            // walker, and state can be used to give this walked an initial
            // state.

            exports.simple = simple;

            // An ancestor walk builds up an array of ancestor nodes (including
            // the current node) and passes them to the callback as the state parameter.
            exports.ancestor = ancestor;

            // A recursive walk is one where your functions override the default
            // walkers. They can modify and replace the state parameter that's
            // threaded through the walk, and can opt how and whether to walk
            // their child nodes (by calling their third argument on these
            // nodes).
            exports.recursive = recursive;

            // Find a node with a given start, end, and type (all are optional,
            // null can be used as wildcard). Returns a {node, state} object, or
            // undefined when it doesn't find a matching node.
            exports.findNodeAt = findNodeAt;

            // Find the innermost node of a given type that contains the given
            // position. Interface similar to findNodeAt.
            exports.findNodeAround = findNodeAround;

            // Find the outermost matching node after a given position.
            exports.findNodeAfter = findNodeAfter;

            // Find the outermost matching node before a given position.
            exports.findNodeBefore = findNodeBefore;

            // Used to create a custom walker. Will fill in all missing node
            // type properties with the defaults.
            exports.make = make;
            Object.defineProperty(exports, "__esModule", {
                value: true
            });

            function simple(node, visitors, base, state) {
                if (!base) base = exports.base;
                (function c(node, st, override) {
                    var type = override || node.type,
                        found = visitors[type];
                    base[type](node, st, c);
                    if (found) found(node, st);
                })(node, state);
            }

            function ancestor(node, visitors, base, state) {
                if (!base) base = exports.base;
                if (!state) state = [];
                (function c(node, st, override) {
                    var type = override || node.type,
                        found = visitors[type];
                    if (node != st[st.length - 1]) {
                        st = st.slice();
                        st.push(node);
                    }
                    base[type](node, st, c);
                    if (found) found(node, st);
                })(node, state);
            }

            function recursive(node, state, funcs, base) {
                var visitor = funcs ? exports.make(funcs, base) : base;
                (function c(node, st, override) {
                    visitor[override || node.type](node, st, c);
                })(node, state);
            }

            function makeTest(test) {
                if (typeof test == "string") {
                    return function(type) {
                        return type == test;
                    };
                }
                else if (!test) {
                    return function() {
                        return true;
                    };
                }
                else {
                    return test;
                }
            }

            var Found = function Found(node, state) {
                _classCallCheck(this, Found);

                this.node = node;
                this.state = state;
            };

            function findNodeAt(node, start, end, test, base, state) {
                test = makeTest(test);
                if (!base) base = exports.base;
                try {;
                    (function c(node, st, override) {
                        var type = override || node.type;
                        if ((start == null || node.start <= start) && (end == null || node.end >= end)) base[type](node, st, c);
                        if (test(type, node) && (start == null || node.start == start) && (end == null || node.end == end)) throw new Found(node, st);
                    })(node, state);
                }
                catch (e) {
                    if (e instanceof Found) {
                        return e;
                    }
                    throw e;
                }
            }

            function findNodeAround(node, pos, test, base, state) {
                test = makeTest(test);
                if (!base) base = exports.base;
                try {;
                    (function c(node, st, override) {
                        var type = override || node.type;
                        if (node.start > pos || node.end < pos) {
                            return;
                        }
                        base[type](node, st, c);
                        if (test(type, node)) throw new Found(node, st);
                    })(node, state);
                }
                catch (e) {
                    if (e instanceof Found) {
                        return e;
                    }
                    throw e;
                }
            }

            function findNodeAfter(node, pos, test, base, state) {
                test = makeTest(test);
                if (!base) base = exports.base;
                try {;
                    (function c(node, st, override) {
                        if (node.end < pos) {
                            return;
                        }
                        var type = override || node.type;
                        if (node.start >= pos && test(type, node)) throw new Found(node, st);
                        base[type](node, st, c);
                    })(node, state);
                }
                catch (e) {
                    if (e instanceof Found) {
                        return e;
                    }
                    throw e;
                }
            }

            function findNodeBefore(node, pos, test, base, state) {
                test = makeTest(test);
                if (!base) base = exports.base;
                var max = undefined;
                (function c(node, st, override) {
                    if (node.start > pos) {
                        return;
                    }
                    var type = override || node.type;
                    if (node.end <= pos && (!max || max.node.end < node.end) && test(type, node)) max = new Found(node, st);
                    base[type](node, st, c);
                })(node, state);
                return max;
            }

            function make(funcs, base) {
                if (!base) base = exports.base;
                var visitor = {};
                for (var type in base) visitor[type] = base[type];
                for (var type in funcs) visitor[type] = funcs[type];
                return visitor;
            }

            function skipThrough(node, st, c) {
                c(node, st);
            }

            function ignore(_node, _st, _c) {}

            // Node walkers.

            var base = {};

            exports.base = base;
            base.Program = base.BlockStatement = function(node, st, c) {
                for (var i = 0; i < node.body.length; ++i) {
                    c(node.body[i], st, "Statement");
                }
            };
            base.Statement = skipThrough;
            base.EmptyStatement = ignore;
            base.ExpressionStatement = base.ParenthesizedExpression = function(node, st, c) {
                return c(node.expression, st, "Expression");
            };
            base.IfStatement = function(node, st, c) {
                c(node.test, st, "Expression");
                c(node.consequent, st, "Statement");
                if (node.alternate) c(node.alternate, st, "Statement");
            };
            base.LabeledStatement = function(node, st, c) {
                return c(node.body, st, "Statement");
            };
            base.BreakStatement = base.ContinueStatement = ignore;
            base.WithStatement = function(node, st, c) {
                c(node.object, st, "Expression");
                c(node.body, st, "Statement");
            };
            base.SwitchStatement = function(node, st, c) {
                c(node.discriminant, st, "Expression");
                for (var i = 0; i < node.cases.length; ++i) {
                    var cs = node.cases[i];
                    if (cs.test) c(cs.test, st, "Expression");
                    for (var j = 0; j < cs.consequent.length; ++j) {
                        c(cs.consequent[j], st, "Statement");
                    }
                }
            };
            base.ReturnStatement = base.YieldExpression = function(node, st, c) {
                if (node.argument) c(node.argument, st, "Expression");
            };
            base.ThrowStatement = base.SpreadElement = base.RestElement = function(node, st, c) {
                return c(node.argument, st, "Expression");
            };
            base.TryStatement = function(node, st, c) {
                c(node.block, st, "Statement");
                if (node.handler) c(node.handler.body, st, "ScopeBody");
                if (node.finalizer) c(node.finalizer, st, "Statement");
            };
            base.WhileStatement = base.DoWhileStatement = function(node, st, c) {
                c(node.test, st, "Expression");
                c(node.body, st, "Statement");
            };
            base.ForStatement = function(node, st, c) {
                if (node.init) c(node.init, st, "ForInit");
                if (node.test) c(node.test, st, "Expression");
                if (node.update) c(node.update, st, "Expression");
                c(node.body, st, "Statement");
            };
            base.ForInStatement = base.ForOfStatement = function(node, st, c) {
                c(node.left, st, "ForInit");
                c(node.right, st, "Expression");
                c(node.body, st, "Statement");
            };
            base.ForInit = function(node, st, c) {
                if (node.type == "VariableDeclaration") c(node, st);
                else c(node, st, "Expression");
            };
            base.DebuggerStatement = ignore;

            base.FunctionDeclaration = function(node, st, c) {
                return c(node, st, "Function");
            };
            base.VariableDeclaration = function(node, st, c) {
                for (var i = 0; i < node.declarations.length; ++i) {
                    var decl = node.declarations[i];
                    if (decl.init) c(decl.init, st, "Expression");
                }
            };

            base.Function = function(node, st, c) {
                return c(node.body, st, "ScopeBody");
            };
            base.ScopeBody = function(node, st, c) {
                return c(node, st, "Statement");
            };

            base.Expression = skipThrough;
            base.ThisExpression = base.Super = base.MetaProperty = ignore;
            base.ArrayExpression = base.ArrayPattern = function(node, st, c) {
                for (var i = 0; i < node.elements.length; ++i) {
                    var elt = node.elements[i];
                    if (elt) c(elt, st, "Expression");
                }
            };
            base.ObjectExpression = base.ObjectPattern = function(node, st, c) {
                for (var i = 0; i < node.properties.length; ++i) {
                    c(node.properties[i], st);
                }
            };
            base.FunctionExpression = base.ArrowFunctionExpression = base.FunctionDeclaration;
            base.SequenceExpression = base.TemplateLiteral = function(node, st, c) {
                for (var i = 0; i < node.expressions.length; ++i) {
                    c(node.expressions[i], st, "Expression");
                }
            };
            base.UnaryExpression = base.UpdateExpression = function(node, st, c) {
                c(node.argument, st, "Expression");
            };
            base.BinaryExpression = base.AssignmentExpression = base.AssignmentPattern = base.LogicalExpression = function(node, st, c) {
                c(node.left, st, "Expression");
                c(node.right, st, "Expression");
            };
            base.ConditionalExpression = function(node, st, c) {
                c(node.test, st, "Expression");
                c(node.consequent, st, "Expression");
                c(node.alternate, st, "Expression");
            };
            base.NewExpression = base.CallExpression = function(node, st, c) {
                c(node.callee, st, "Expression");
                if (node.arguments) for (var i = 0; i < node.arguments.length; ++i) {
                    c(node.arguments[i], st, "Expression");
                }
            };
            base.MemberExpression = function(node, st, c) {
                c(node.object, st, "Expression");
                if (node.computed) c(node.property, st, "Expression");
            };
            base.ExportNamedDeclaration = base.ExportDefaultDeclaration = function(node, st, c) {
                return c(node.declaration, st);
            };
            base.ImportDeclaration = function(node, st, c) {
                for (var i = 0; i < node.specifiers.length; i++) {
                    c(node.specifiers[i], st);
                }
            };
            base.ImportSpecifier = base.ImportDefaultSpecifier = base.ImportNamespaceSpecifier = base.Identifier = base.Literal = ignore;

            base.TaggedTemplateExpression = function(node, st, c) {
                c(node.tag, st, "Expression");
                c(node.quasi, st);
            };
            base.ClassDeclaration = base.ClassExpression = function(node, st, c) {
                if (node.superClass) c(node.superClass, st, "Expression");
                for (var i = 0; i < node.body.body.length; i++) {
                    c(node.body.body[i], st);
                }
            };
            base.MethodDefinition = base.Property = function(node, st, c) {
                if (node.computed) c(node.key, st, "Expression");
                c(node.value, st, "Expression");
            };
            base.ComprehensionExpression = function(node, st, c) {
                for (var i = 0; i < node.blocks.length; i++) {
                    c(node.blocks[i].right, st, "Expression");
                }
                c(node.body, st, "Expression");
            };

        }, {}]
    }, {}, [1])(1)
});

//#endregion


//#region tern/lib/signal.js

(function(root, mod) {
    if (typeof exports == "object" && typeof module == "object") // CommonJS
    return mod(exports);
    if (typeof define == "function" && define.amd) // AMD
    return define(["exports"], mod);
    mod((root.tern || (root.tern = {})).signal = {}); // Plain browser env
})(this, function(exports) {
    function on(type, f) {
        var handlers = this._handlers || (this._handlers = Object.create(null));
        (handlers[type] || (handlers[type] = [])).push(f);
    }

    function off(type, f) {
        var arr = this._handlers && this._handlers[type];
        if (arr) for (var i = 0; i < arr.length; ++i)
        if (arr[i] == f) {
            arr.splice(i, 1);
            break;
        }
    }

    function signal(type, a1, a2, a3, a4) {
        var arr = this._handlers && this._handlers[type];
        if (arr) for (var i = 0; i < arr.length; ++i) arr[i].call(this, a1, a2, a3, a4);
    }

    exports.mixin = function(obj) {
        obj.on = on;
        obj.off = off;
        obj.signal = signal;
        return obj;
    };
});

//#endregion


//#region tern/lib/tern.js

// The Tern server object

// A server is a stateful object that manages the analysis for a
// project, and defines an interface for querying the code in the
// project.

(function(root, mod) {
    if (typeof exports == "object" && typeof module == "object") // CommonJS
    return mod(exports, require("./infer"), require("./signal"),
    require("acorn"), require("acorn/dist/walk"));
    if (typeof define == "function" && define.amd) // AMD
    return define(["exports", "./infer", "./signal", "acorn/dist/acorn", "acorn/dist/walk"], mod);
    mod(root.tern || (root.tern = {}), tern, tern.signal, acorn, acorn.walk); // Plain browser env
})(this, function(exports, infer, signal, acorn, walk) {
    "use strict";

    var plugins = Object.create(null);
    exports.registerPlugin = function(name, init) {
        plugins[name] = init;
    };

    var defaultOptions = exports.defaultOptions = {
        debug: false,
        async: false,
        getFile: function(_f, c) {
            if (this.async) c(null, null);
        },
        defs: [],
        plugins: {},
        fetchTimeout: 1000,
        dependencyBudget: 20000,
        reuseInstances: true,
        stripCRs: false
    };

    var queryTypes = {
        completions: {
            takesFile: true,
            run: findCompletions
        },
        properties: {
            run: findProperties
        },
        type: {
            takesFile: true,
            run: findTypeAt
        },
        documentation: {
            takesFile: true,
            run: findDocs
        },
        definition: {
            takesFile: true,
            run: findDef
        },
        refs: {
            takesFile: true,
            fullFile: true,
            run: findRefs
        },
        rename: {
            takesFile: true,
            fullFile: true,
            run: buildRename
        },
        files: {
            run: listFiles
        }
    };

    exports.defineQueryType = function(name, desc) {
        queryTypes[name] = desc;
    };

    function File(name, parent) {
        this.name = name;
        this.parent = parent;
        this.scope = this.text = this.ast = this.lineOffsets = null;
    }
    File.prototype.asLineChar = function(pos) {
        return asLineChar(this, pos);
    };

    function updateText(file, text, srv) {
        file.text = srv.options.stripCRs ? text.replace(/\r\n/g, "\n") : text;
        infer.withContext(srv.cx, function() {
            file.ast = infer.parse(file.text, srv.passes, {
                directSourceFile: file,
                allowReturnOutsideFunction: true
            });
        });
        file.lineOffsets = null;
    }

    var Server = exports.Server = function(options) {
        this.cx = null;
        this.options = options || {};
        for (var o in defaultOptions) if (!options.hasOwnProperty(o)) options[o] = defaultOptions[o];

        this.handlers = Object.create(null);
        this.files = [];
        this.fileMap = Object.create(null);
        this.needsPurge = [];
        this.budgets = Object.create(null);
        this.uses = 0;
        this.pending = 0;
        this.asyncError = null;
        this.passes = Object.create(null);

        this.defs = options.defs.slice(0);
        for (var plugin in options.plugins) if (options.plugins.hasOwnProperty(plugin) && plugin in plugins) {
            var init = plugins[plugin](this, options.plugins[plugin]);
            if (init && init.defs) {
                if (init.loadFirst) this.defs.unshift(init.defs);
                else this.defs.push(init.defs);
            }
            if (init && init.passes) for (var type in init.passes) if (init.passes.hasOwnProperty(type))
            (this.passes[type] || (this.passes[type] = [])).push(init.passes[type]);
        }

        this.reset();
    };
    Server.prototype = signal.mixin({
        addFile: function(name, /*optional*/ text, parent) {
            // Don't crash when sloppy plugins pass non-existent parent ids
            if (parent && !(parent in this.fileMap)) parent = null;
            ensureFile(this, name, parent, text);
        },
        delFile: function(name) {
            var file = this.findFile(name);
            if (file) {
                this.needsPurge.push(file.name);
                this.files.splice(this.files.indexOf(file), 1);
                delete this.fileMap[name];
            }
        },
        reset: function() {
            this.signal("reset");
            this.cx = new infer.Context(this.defs, this);
            this.uses = 0;
            this.budgets = Object.create(null);
            for (var i = 0; i < this.files.length; ++i) {
                var file = this.files[i];
                file.scope = null;
            }
        },

        request: function(doc, c) {
            var inv = invalidDoc(doc);
            if (inv) return c(inv);

            var self = this;
            doRequest(this, doc, function(err, data) {
                c(err, data);
                if (self.uses > 40) {
                    self.reset();
                    analyzeAll(self, null, function() {});
                }
            });
        },

        findFile: function(name) {
            return this.fileMap[name];
        },

        flush: function(c) {
            var cx = this.cx;
            analyzeAll(this, null, function(err) {
                if (err) return c(err);
                infer.withContext(cx, c);
            });
        },

        startAsyncAction: function() {
            ++this.pending;
        },
        finishAsyncAction: function(err) {
            if (err) this.asyncError = err;
            if (--this.pending === 0) this.signal("everythingFetched");
        }
    });

    function doRequest(srv, doc, c) {
        if (doc.query && !queryTypes.hasOwnProperty(doc.query.type)) return c("No query type '" + doc.query.type + "' defined");

        var query = doc.query;
        // Respond as soon as possible when this just uploads files
        if (!query) c(null, {});

        var files = doc.files || [];
        if (files.length)++srv.uses;
        for (var i = 0; i < files.length; ++i) {
            var file = files[i];
            if (file.type == "delete") srv.delFile(file.name);
            else ensureFile(srv, file.name, null, file.type == "full" ? file.text : null);
        }

        var timeBudget = typeof doc.timeout == "number" ? [doc.timeout] : null;
        if (!query) {
            analyzeAll(srv, timeBudget, function() {});
            return;
        }

        var queryType = queryTypes[query.type];
        if (queryType.takesFile) {
            if (typeof query.file != "string") return c(".query.file must be a string");
            if (!/^#/.test(query.file)) ensureFile(srv, query.file, null);
        }

        analyzeAll(srv, timeBudget, function(err) {
            if (err) return c(err);
            var file = queryType.takesFile && resolveFile(srv, files, query.file);
            if (queryType.fullFile && file.type == "part") return c("Can't run a " + query.type + " query on a file fragment");

            function run() {
                var result;
                try {
                    result = queryType.run(srv, query, file);
                }
                catch (e) {
                    if (srv.options.debug && e.name != "TernError") console.error(e.stack);
                    return c(e);
                }
                c(null, result);
            }
            infer.withContext(srv.cx, timeBudget ? function() {
                infer.withTimeout(timeBudget[0], run);
            } : run);
        });
    }

    function analyzeFile(srv, file) {
        infer.withContext(srv.cx, function() {
            file.scope = srv.cx.topScope;
            srv.signal("beforeLoad", file);
            infer.analyze(file.ast, file.name, file.scope, srv.passes);
            srv.signal("afterLoad", file);
        });
        return file;
    }

    function ensureFile(srv, name, parent, text) {
        var known = srv.findFile(name);
        if (known) {
            if (text != null) {
                if (known.scope) {
                    srv.needsPurge.push(name);
                    known.scope = null;
                }
                updateText(known, text, srv);
            }
            if (parentDepth(srv, known.parent) > parentDepth(srv, parent)) {
                known.parent = parent;
                if (known.excluded) known.excluded = null;
            }
            return;
        }

        var file = new File(name, parent);
        srv.files.push(file);
        srv.fileMap[name] = file;
        if (text != null) {
            updateText(file, text, srv);
        }
        else if (srv.options.async) {
            srv.startAsyncAction();
            srv.options.getFile(name, function(err, text) {
                updateText(file, text || "", srv);
                srv.finishAsyncAction(err);
            });
        }
        else {
            updateText(file, srv.options.getFile(name) || "", srv);
        }
    }

    function fetchAll(srv, c) {
        var done = true,
            returned = false;
        srv.files.forEach(function(file) {
            if (file.text != null) return;
            if (srv.options.async) {
                done = false;
                srv.options.getFile(file.name, function(err, text) {
                    if (err && !returned) {
                        returned = true;
                        return c(err);
                    }
                    updateText(file, text || "", srv);
                    fetchAll(srv, c);
                });
            }
            else {
                try {
                    updateText(file, srv.options.getFile(file.name) || "", srv);
                }
                catch (e) {
                    return c(e);
                }
            }
        });
        if (done) c();
    }

    function waitOnFetch(srv, timeBudget, c) {
        var done = function() {
            srv.off("everythingFetched", done);
            clearTimeout(timeout);
            analyzeAll(srv, timeBudget, c);
        };
        srv.on("everythingFetched", done);
        var timeout = setTimeout(done, srv.options.fetchTimeout);
    }

    function analyzeAll(srv, timeBudget, c) {
        if (srv.pending) return waitOnFetch(srv, timeBudget, c);

        var e = srv.fetchError;
        if (e) {
            srv.fetchError = null;
            return c(e);
        }

        if (srv.needsPurge.length > 0) infer.withContext(srv.cx, function() {
            infer.purge(srv.needsPurge);
            srv.needsPurge.length = 0;
        });

        var done = true;
        // The second inner loop might add new files. The outer loop keeps
        // repeating both inner loops until all files have been looked at.
        for (var i = 0; i < srv.files.length;) {
            var toAnalyze = [];
            for (; i < srv.files.length; ++i) {
                var file = srv.files[i];
                if (file.text == null) done = false;
                else if (file.scope == null && !file.excluded) toAnalyze.push(file);
            }
            toAnalyze.sort(function(a, b) {
                return parentDepth(srv, a.parent) - parentDepth(srv, b.parent);
            });
            for (var j = 0; j < toAnalyze.length; j++) {
                var file = toAnalyze[j];
                if (file.parent && !chargeOnBudget(srv, file)) {
                    file.excluded = true;
                }
                else if (timeBudget) {
                    var startTime = +new Date;
                    infer.withTimeout(timeBudget[0], function() {
                        analyzeFile(srv, file);
                    });
                    timeBudget[0] -= +new Date - startTime;
                }
                else {
                    analyzeFile(srv, file);
                }
            }
        }
        if (done) c();
        else waitOnFetch(srv, timeBudget, c);
    }

    function firstLine(str) {
        var end = str.indexOf("\n");
        if (end < 0) return str;
        return str.slice(0, end);
    }

    function findMatchingPosition(line, file, near) {
        var pos = Math.max(0, near - 500),
            closest = null;
        if (!/^\s*$/.test(line)) for (;;) {
            var found = file.indexOf(line, pos);
            if (found < 0 || found > near + 500) break;
            if (closest == null || Math.abs(closest - near) > Math.abs(found - near)) closest = found;
            pos = found + line.length;
        }
        return closest;
    }

    function scopeDepth(s) {
        for (var i = 0; s; ++i, s = s.prev) {}
        return i;
    }

    function ternError(msg) {
        var err = new Error(msg);
        err.name = "TernError";
        return err;
    }

    function resolveFile(srv, localFiles, name) {
        var isRef = name.match(/^#(\d+)$/);
        if (!isRef) return srv.findFile(name);

        var file = localFiles[isRef[1]];
        if (!file || file.type == "delete") throw ternError("Reference to unknown file " + name);
        if (file.type == "full") return srv.findFile(file.name);

        // This is a partial file

        var realFile = file.backing = srv.findFile(file.name);
        var offset = file.offset;
        if (file.offsetLines) offset = {
            line: file.offsetLines,
            ch: 0
        };
        file.offset = offset = resolvePos(realFile, file.offsetLines == null ? file.offset : {
            line: file.offsetLines,
            ch: 0
        }, true);
        var line = firstLine(file.text);
        var foundPos = findMatchingPosition(line, realFile.text, offset);
        var pos = foundPos == null ? Math.max(0, realFile.text.lastIndexOf("\n", offset)) : foundPos;
        var inObject, atFunction;

        infer.withContext(srv.cx, function() {
            infer.purge(file.name, pos, pos + file.text.length);

            var text = file.text,
                m;
            if (m = text.match(/(?:"([^"]*)"|([\w$]+))\s*:\s*function\b/)) {
                var objNode = walk.findNodeAround(file.backing.ast, pos, "ObjectExpression");
                if (objNode && objNode.node.objType) inObject = {
                    type: objNode.node.objType,
                    prop: m[2] || m[1]
                };
            }
            if (foundPos && (m = line.match(/^(.*?)\bfunction\b/))) {
                var cut = m[1].length,
                    white = "";
                for (var i = 0; i < cut; ++i) white += " ";
                text = white + text.slice(cut);
                atFunction = true;
            }

            var scopeStart = infer.scopeAt(realFile.ast, pos, realFile.scope);
            var scopeEnd = infer.scopeAt(realFile.ast, pos + text.length, realFile.scope);
            var scope = file.scope = scopeDepth(scopeStart) < scopeDepth(scopeEnd) ? scopeEnd : scopeStart;
            file.ast = infer.parse(text, srv.passes, {
                directSourceFile: file,
                allowReturnOutsideFunction: true
            });
            infer.analyze(file.ast, file.name, scope, srv.passes);

            // This is a kludge to tie together the function types (if any)
            // outside and inside of the fragment, so that arguments and
            // return values have some information known about them.
            tieTogether: if (inObject || atFunction) {
                var newInner = infer.scopeAt(file.ast, line.length, scopeStart);
                if (!newInner.fnType) break tieTogether;
                if (inObject) {
                    var prop = inObject.type.getProp(inObject.prop);
                    prop.addType(newInner.fnType);
                }
                else if (atFunction) {
                    var inner = infer.scopeAt(realFile.ast, pos + line.length, realFile.scope);
                    if (inner == scopeStart || !inner.fnType) break tieTogether;
                    var fOld = inner.fnType,
                        fNew = newInner.fnType;
                    if (!fNew || (fNew.name != fOld.name && fOld.name)) break tieTogether;
                    for (var i = 0, e = Math.min(fOld.args.length, fNew.args.length); i < e; ++i)
                    fOld.args[i].propagate(fNew.args[i]);
                    fOld.self.propagate(fNew.self);
                    fNew.retval.propagate(fOld.retval);
                }
            }
        });
        return file;
    }

    // Budget management

    function astSize(node) {
        var size = 0;
        walk.simple(node, {
            Expression: function() {
                ++size;
            }
        });
        return size;
    }

    function parentDepth(srv, parent) {
        var depth = 0;
        while (parent) {
            parent = srv.findFile(parent).parent;
            ++depth;
        }
        return depth;
    }

    function budgetName(srv, file) {
        for (;;) {
            var parent = srv.findFile(file.parent);
            if (!parent.parent) break;
            file = parent;
        }
        return file.name;
    }

    function chargeOnBudget(srv, file) {
        var bName = budgetName(srv, file);
        var size = astSize(file.ast);
        var known = srv.budgets[bName];
        if (known == null) known = srv.budgets[bName] = srv.options.dependencyBudget;
        if (known < size) return false;
        srv.budgets[bName] = known - size;
        return true;
    }

    // Query helpers

    function isPosition(val) {
        return typeof val == "number" || typeof val == "object" && typeof val.line == "number" && typeof val.ch == "number";
    }

    // Baseline query document validation
    function invalidDoc(doc) {
        if (doc.query) {
            if (typeof doc.query.type != "string") return ".query.type must be a string";
            if (doc.query.start && !isPosition(doc.query.start)) return ".query.start must be a position";
            if (doc.query.end && !isPosition(doc.query.end)) return ".query.end must be a position";
        }
        if (doc.files) {
            if (!Array.isArray(doc.files)) return "Files property must be an array";
            for (var i = 0; i < doc.files.length; ++i) {
                var file = doc.files[i];
                if (typeof file != "object") return ".files[n] must be objects";
                else if (typeof file.name != "string") return ".files[n].name must be a string";
                else if (file.type == "delete") continue;
                else if (typeof file.text != "string") return ".files[n].text must be a string";
                else if (file.type == "part") {
                    if (!isPosition(file.offset) && typeof file.offsetLines != "number") return ".files[n].offset must be a position";
                }
                else if (file.type != "full") return ".files[n].type must be \"full\" or \"part\"";
            }
        }
    }

    var offsetSkipLines = 25;

    function findLineStart(file, line) {
        var text = file.text,
            offsets = file.lineOffsets || (file.lineOffsets = [0]);
        var pos = 0,
            curLine = 0;
        var storePos = Math.min(Math.floor(line / offsetSkipLines), offsets.length - 1);
        var pos = offsets[storePos],
            curLine = storePos * offsetSkipLines;

        while (curLine < line) {
            ++curLine;
            pos = text.indexOf("\n", pos) + 1;
            if (pos === 0) return null;
            if (curLine % offsetSkipLines === 0) offsets.push(pos);
        }
        return pos;
    }

    var resolvePos = exports.resolvePos = function(file, pos, tolerant) {
        if (typeof pos != "number") {
            var lineStart = findLineStart(file, pos.line);
            if (lineStart == null) {
                if (tolerant) pos = file.text.length;
                else throw ternError("File doesn't contain a line " + pos.line);
            }
            else {
                pos = lineStart + pos.ch;
            }
        }
        if (pos > file.text.length) {
            if (tolerant) pos = file.text.length;
            else throw ternError("Position " + pos + " is outside of file.");
        }
        return pos;
    };

    function asLineChar(file, pos) {
        if (!file) return {
            line: 0,
            ch: 0
        };
        var offsets = file.lineOffsets || (file.lineOffsets = [0]);
        var text = file.text,
            line, lineStart;
        for (var i = offsets.length - 1; i >= 0; --i) if (offsets[i] <= pos) {
            line = i * offsetSkipLines;
            lineStart = offsets[i];
        }
        for (;;) {
            var eol = text.indexOf("\n", lineStart);
            if (eol >= pos || eol < 0) break;
            lineStart = eol + 1;
            ++line;
        }
        return {
            line: line,
            ch: pos - lineStart
        };
    }

    var outputPos = exports.outputPos = function(query, file, pos) {
        if (query.lineCharPositions) {
            var out = asLineChar(file, pos);
            if (file.type == "part") out.line += file.offsetLines != null ? file.offsetLines : asLineChar(file.backing, file.offset).line;
            return out;
        }
        else {
            return pos + (file.type == "part" ? file.offset : 0);
        }
    };

    // Delete empty fields from result objects
    function clean(obj) {
        for (var prop in obj) if (obj[prop] == null) delete obj[prop];
        return obj;
    }

    function maybeSet(obj, prop, val) {
        if (val != null) obj[prop] = val;
    }

    // Built-in query types

    function compareCompletions(a, b) {
        if (typeof a != "string") {
            a = a.name;
            b = b.name;
        }
        var aUp = /^[A-Z]/.test(a),
            bUp = /^[A-Z]/.test(b);
        if (aUp == bUp) return a < b ? -1 : a == b ? 0 : 1;
        else return aUp ? 1 : -1;
    }

    function isStringAround(node, start, end) {
        return node.type == "Literal" && typeof node.value == "string" && node.start == start - 1 && node.end <= end + 1;
    }

    function pointInProp(objNode, point) {
        for (var i = 0; i < objNode.properties.length; i++) {
            var curProp = objNode.properties[i];
            if (curProp.key.start <= point && curProp.key.end >= point) return curProp;
        }
    }

    var jsKeywords = ("break do instanceof typeof case else new var " + "catch finally return void continue for switch while debugger " + "function this with default if throw delete in try").split(" ");

    function findCompletions(srv, query, file) {
        if (query.end == null) throw ternError("missing .query.end field");
        if (srv.passes.completion) for (var i = 0; i < srv.passes.completion.length; i++) {
            var result = srv.passes.completion[i](file, query);
            if (result) return result;
        }

        var wordStart = resolvePos(file, query.end),
            wordEnd = wordStart,
            text = file.text;
        while (wordStart && acorn.isIdentifierChar(text.charCodeAt(wordStart - 1)))--wordStart;
        if (query.expandWordForward !== false) while (wordEnd < text.length && acorn.isIdentifierChar(text.charCodeAt(wordEnd)))++wordEnd;
        var word = text.slice(wordStart, wordEnd),
            completions = [],
            ignoreObj;
        if (query.caseInsensitive) word = word.toLowerCase();
        var wrapAsObjs = query.types || query.depths || query.docs || query.urls || query.origins;

        function gather(prop, obj, depth, addInfo) {
            // 'hasOwnProperty' and such are usually just noise, leave them
            // out when no prefix is provided.
            if (query.omitObjectPrototype !== false && obj == srv.cx.protos.Object && !word) return;
            if (query.filter !== false && word && (query.caseInsensitive ? prop.toLowerCase() : prop).indexOf(word) !== 0) return;
            if (ignoreObj && ignoreObj.props[prop]) return;
            for (var i = 0; i < completions.length; ++i) {
                var c = completions[i];
                if ((wrapAsObjs ? c.name : c) == prop) return;
            }
            var rec = wrapAsObjs ? {
                name: prop
            } : prop;
            completions.push(rec);

            if (obj && (query.types || query.docs || query.urls || query.origins)) {
                var val = obj.props[prop];
                infer.resetGuessing();
                var type = val.getType();
                rec.guess = infer.didGuess();
                if (query.types) rec.type = infer.toString(val);
                if (query.docs) maybeSet(rec, "doc", val.doc || type && type.doc);
                if (query.urls) maybeSet(rec, "url", val.url || type && type.url);
                if (query.origins) maybeSet(rec, "origin", val.origin || type && type.origin);
            }
            if (query.depths) rec.depth = depth;
            if (wrapAsObjs && addInfo) addInfo(rec);
        }

        var hookname, prop, objType, isKey;

        var exprAt = infer.findExpressionAround(file.ast, null, wordStart, file.scope);
        var memberExpr, objLit;
        // Decide whether this is an object property, either in a member
        // expression or an object literal.
        if (exprAt) {
            if (exprAt.node.type == "MemberExpression" && exprAt.node.object.end < wordStart) {
                memberExpr = exprAt;
            }
            else if (isStringAround(exprAt.node, wordStart, wordEnd)) {
                var parent = infer.parentNode(exprAt.node, file.ast);
                if (parent.type == "MemberExpression" && parent.property == exprAt.node) memberExpr = {
                    node: parent,
                    state: exprAt.state
                };
            }
            else if (exprAt.node.type == "ObjectExpression") {
                var objProp = pointInProp(exprAt.node, wordEnd);
                if (objProp) {
                    objLit = exprAt;
                    prop = isKey = objProp.key.name;
                }
                else if (!word && !/:\s*$/.test(file.text.slice(0, wordStart))) {
                    objLit = exprAt;
                    prop = isKey = true;
                }
            }
        }

        if (objLit) {
            // Since we can't use the type of the literal itself to complete
            // its properties (it doesn't contain the information we need),
            // we have to try asking the surrounding expression for type info.
            objType = infer.typeFromContext(file.ast, objLit);
            ignoreObj = objLit.node.objType;
        }
        else if (memberExpr) {
            prop = memberExpr.node.property;
            prop = prop.type == "Literal" ? prop.value.slice(1) : prop.name;
            memberExpr.node = memberExpr.node.object;
            objType = infer.expressionType(memberExpr);
        }
        else if (text.charAt(wordStart - 1) == ".") {
            var pathStart = wordStart - 1;
            while (pathStart && (text.charAt(pathStart - 1) == "." || acorn.isIdentifierChar(text.charCodeAt(pathStart - 1)))) pathStart--;
            var path = text.slice(pathStart, wordStart - 1);
            if (path) {
                objType = infer.def.parsePath(path, file.scope).getObjType();
                prop = word;
            }
        }

        if (prop != null) {
            srv.cx.completingProperty = prop;

            if (objType) infer.forAllPropertiesOf(objType, gather);

            if (!completions.length && query.guess !== false && objType && objType.guessProperties) objType.guessProperties(function(p, o, d) {
                if (p != prop && p != "✖") gather(p, o, d);
            });
            if (!completions.length && word.length >= 2 && query.guess !== false) for (var prop in srv.cx.props) gather(prop, srv.cx.props[prop][0], 0);
            hookname = "memberCompletion";
        }
        else {
            infer.forAllLocalsAt(file.ast, wordStart, file.scope, gather);
            if (query.includeKeywords) jsKeywords.forEach(function(kw) {
                gather(kw, null, 0, function(rec) {
                    rec.isKeyword = true;
                });
            });
            hookname = "variableCompletion";
        }
        if (srv.passes[hookname]) srv.passes[hookname].forEach(function(hook) {
            hook(file, wordStart, wordEnd, gather);
        });

        if (query.sort !== false) completions.sort(compareCompletions);
        srv.cx.completingProperty = null;

        return {
            start: outputPos(query, file, wordStart),
            end: outputPos(query, file, wordEnd),
            isProperty: !! prop,
            isObjectKey: !! isKey,
            completions: completions
        };
    }

    function findProperties(srv, query) {
        var prefix = query.prefix,
            found = [];
        for (var prop in srv.cx.props)
        if (prop != "<i>" && (!prefix || prop.indexOf(prefix) === 0)) found.push(prop);
        if (query.sort !== false) found.sort(compareCompletions);
        return {
            completions: found
        };
    }

    var findExpr = exports.findQueryExpr = function(file, query, wide) {
        if (query.end == null) throw ternError("missing .query.end field");

        if (query.variable) {
            var scope = infer.scopeAt(file.ast, resolvePos(file, query.end), file.scope);
            return {
                node: {
                    type: "Identifier",
                    name: query.variable,
                    start: query.end,
                    end: query.end + 1
                },
                state: scope
            };
        }
        else {
            var start = query.start && resolvePos(file, query.start),
                end = resolvePos(file, query.end);
            var expr = infer.findExpressionAt(file.ast, start, end, file.scope);
            if (expr) return expr;
            expr = infer.findExpressionAround(file.ast, start, end, file.scope);
            if (expr && (expr.node.type == "ObjectExpression" || wide || (start == null ? end : start) - expr.node.start < 20 || expr.node.end - end < 20)) return expr;
            return null;
        }
    };

    function findExprOrThrow(file, query, wide) {
        var expr = findExpr(file, query, wide);
        if (expr) return expr;
        throw ternError("No expression at the given position.");
    }

    function ensureObj(tp) {
        if (!tp || !(tp = tp.getType()) || !(tp instanceof infer.Obj)) return null;
        return tp;
    }

    function findExprType(srv, query, file, expr) {
        var type;
        if (expr) {
            infer.resetGuessing();
            type = infer.expressionType(expr);
        }
        if (srv.passes["typeAt"]) {
            var pos = resolvePos(file, query.end);
            srv.passes["typeAt"].forEach(function(hook) {
                type = hook(file, pos, expr, type);
            });
        }
        if (!type) throw ternError("No type found at the given position.");

        var objProp;
        if (expr.node.type == "ObjectExpression" && query.end != null && (objProp = pointInProp(expr.node, resolvePos(file, query.end)))) {
            var name = objProp.key.name;
            var fromCx = ensureObj(infer.typeFromContext(file.ast, expr));
            if (fromCx && fromCx.hasProp(name)) {
                type = fromCx.hasProp(name);
            }
            else {
                var fromLocal = ensureObj(type);
                if (fromLocal && fromLocal.hasProp(name)) type = fromLocal.hasProp(name);
            }
        }
        return type;
    };

    function findTypeAt(srv, query, file) {
        var expr = findExpr(file, query),
            exprName;
        var type = findExprType(srv, query, file, expr),
            exprType = type;
        if (query.preferFunction) type = type.getFunctionType() || type.getType();
        else type = type.getType();

        if (expr) {
            if (expr.node.type == "Identifier") exprName = expr.node.name;
            else if (expr.node.type == "MemberExpression" && !expr.node.computed) exprName = expr.node.property.name;
        }

        if (query.depth != null && typeof query.depth != "number") throw ternError(".query.depth must be a number");

        var result = {
            guess: infer.didGuess(),
            type: infer.toString(exprType, query.depth),
            name: type && type.name,
            exprName: exprName
        };
        if (type) storeTypeDocs(type, result);
        if (!result.doc && exprType.doc) result.doc = exprType.doc;

        return clean(result);
    }

    function findDocs(srv, query, file) {
        var expr = findExpr(file, query);
        var type = findExprType(srv, query, file, expr);
        var result = {
            url: type.url,
            doc: type.doc,
            type: infer.toString(type)
        };
        var inner = type.getType();
        if (inner) storeTypeDocs(inner, result);
        return clean(result);
    }

    function storeTypeDocs(type, out) {
        if (!out.url) out.url = type.url;
        if (!out.doc) out.doc = type.doc;
        if (!out.origin) out.origin = type.origin;
        var ctor, boring = infer.cx().protos;
        if (!out.url && !out.doc && type.proto && (ctor = type.proto.hasCtor) && type.proto != boring.Object && type.proto != boring.Function && type.proto != boring.Array) {
            out.url = ctor.url;
            out.doc = ctor.doc;
        }
    }

    var getSpan = exports.getSpan = function(obj) {
        if (!obj.origin) return;
        if (obj.originNode) {
            var node = obj.originNode;
            if (/^Function/.test(node.type) && node.id) node = node.id;
            return {
                origin: obj.origin,
                node: node
            };
        }
        if (obj.span) return {
            origin: obj.origin,
            span: obj.span
        };
    };

    var storeSpan = exports.storeSpan = function(srv, query, span, target) {
        target.origin = span.origin;
        if (span.span) {
            var m = /^(\d+)\[(\d+):(\d+)\]-(\d+)\[(\d+):(\d+)\]$/.exec(span.span);
            target.start = query.lineCharPositions ? {
                line: Number(m[2]),
                ch: Number(m[3])
            } : Number(m[1]);
            target.end = query.lineCharPositions ? {
                line: Number(m[5]),
                ch: Number(m[6])
            } : Number(m[4]);
        }
        else {
            var file = srv.findFile(span.origin);
            target.start = outputPos(query, file, span.node.start);
            target.end = outputPos(query, file, span.node.end);
        }
    };

    function findDef(srv, query, file) {
        var expr = findExpr(file, query);
        var type = findExprType(srv, query, file, expr);
        if (infer.didGuess()) return {};

        var span = getSpan(type);
        var result = {
            url: type.url,
            doc: type.doc,
            origin: type.origin
        };

        if (type.types) for (var i = type.types.length - 1; i >= 0; --i) {
            var tp = type.types[i];
            storeTypeDocs(tp, result);
            if (!span) span = getSpan(tp);
        }

        if (span && span.node) { // refers to a loaded file
            var spanFile = span.node.sourceFile || srv.findFile(span.origin);
            var start = outputPos(query, spanFile, span.node.start),
                end = outputPos(query, spanFile, span.node.end);
            result.start = start;
            result.end = end;
            result.file = span.origin;
            var cxStart = Math.max(0, span.node.start - 50);
            result.contextOffset = span.node.start - cxStart;
            result.context = spanFile.text.slice(cxStart, cxStart + 50);
        }
        else if (span) { // external
            result.file = span.origin;
            storeSpan(srv, query, span, result);
        }
        return clean(result);
    }

    function findRefsToVariable(srv, query, file, expr, checkShadowing) {
        var name = expr.node.name;

        for (var scope = expr.state; scope && !(name in scope.props); scope = scope.prev) {}
        if (!scope) throw ternError("Could not find a definition for " + name + " " + !! srv.cx.topScope.props.x);

        var type, refs = [];

        function storeRef(file) {
            return function(node, scopeHere) {
                if (checkShadowing) for (var s = scopeHere; s != scope; s = s.prev) {
                    var exists = s.hasProp(checkShadowing);
                    if (exists) throw ternError("Renaming `" + name + "` to `" + checkShadowing + "` would make a variable at line " + (asLineChar(file, node.start).line + 1) + " point to the definition at line " + (asLineChar(file, exists.name.start).line + 1));
                }
                refs.push({
                    file: file.name,
                    start: outputPos(query, file, node.start),
                    end: outputPos(query, file, node.end)
                });
            };
        }

        if (scope.originNode) {
            type = "local";
            if (checkShadowing) {
                for (var prev = scope.prev; prev; prev = prev.prev)
                if (checkShadowing in prev.props) break;
                if (prev) infer.findRefs(scope.originNode, scope, checkShadowing, prev, function(node) {
                    throw ternError("Renaming `" + name + "` to `" + checkShadowing + "` would shadow the definition used at line " + (asLineChar(file, node.start).line + 1));
                });
            }
            infer.findRefs(scope.originNode, scope, name, scope, storeRef(file));
        }
        else {
            type = "global";
            for (var i = 0; i < srv.files.length; ++i) {
                var cur = srv.files[i];
                infer.findRefs(cur.ast, cur.scope, name, scope, storeRef(cur));
            }
        }

        return {
            refs: refs,
            type: type,
            name: name
        };
    }

    function findRefsToProperty(srv, query, expr, prop) {
        var objType = infer.expressionType(expr).getObjType();
        if (!objType) throw ternError("Couldn't determine type of base object.");

        var refs = [];

        function storeRef(file) {
            return function(node) {
                refs.push({
                    file: file.name,
                    start: outputPos(query, file, node.start),
                    end: outputPos(query, file, node.end)
                });
            };
        }
        for (var i = 0; i < srv.files.length; ++i) {
            var cur = srv.files[i];
            infer.findPropRefs(cur.ast, cur.scope, objType, prop.name, storeRef(cur));
        }

        return {
            refs: refs,
            name: prop.name
        };
    }

    function findRefs(srv, query, file) {
        var expr = findExprOrThrow(file, query, true);
        if (expr && expr.node.type == "Identifier") {
            return findRefsToVariable(srv, query, file, expr);
        }
        else if (expr && expr.node.type == "MemberExpression" && !expr.node.computed) {
            var p = expr.node.property;
            expr.node = expr.node.object;
            return findRefsToProperty(srv, query, expr, p);
        }
        else if (expr && expr.node.type == "ObjectExpression") {
            var pos = resolvePos(file, query.end);
            for (var i = 0; i < expr.node.properties.length; ++i) {
                var k = expr.node.properties[i].key;
                if (k.start <= pos && k.end >= pos) return findRefsToProperty(srv, query, expr, k);
            }
        }
        throw ternError("Not at a variable or property name.");
    }

    function buildRename(srv, query, file) {
        if (typeof query.newName != "string") throw ternError(".query.newName should be a string");
        var expr = findExprOrThrow(file, query);
        if (!expr || expr.node.type != "Identifier") throw ternError("Not at a variable.");

        var data = findRefsToVariable(srv, query, file, expr, query.newName),
            refs = data.refs;
        delete data.refs;
        data.files = srv.files.map(function(f) {
            return f.name;
        });

        var changes = data.changes = [];
        for (var i = 0; i < refs.length; ++i) {
            var use = refs[i];
            use.text = query.newName;
            changes.push(use);
        }

        return data;
    }

    function listFiles(srv) {
        return {
            files: srv.files.map(function(f) {
                return f.name;
            })
        };
    }

    exports.version = "0.10.0";
});

//#endregion


//#region tern/lib/def.js

// Type description parser
//
// Type description JSON files (such as ecma5.json and browser.json)
// are used to
//
// A) describe types that come from native code
//
// B) to cheaply load the types for big libraries, or libraries that
//    can't be inferred well

(function(mod) {
    if (typeof exports == "object" && typeof module == "object") // CommonJS
    return exports.init = mod;
    if (typeof define == "function" && define.amd) // AMD
    return define({
        init: mod
    });
    tern.def = {
        init: mod
    };
})(function(exports, infer) {
    "use strict";

    function hop(obj, prop) {
        return Object.prototype.hasOwnProperty.call(obj, prop);
    }

    var TypeParser = exports.TypeParser = function(spec, start, base, forceNew) {
        this.pos = start || 0;
        this.spec = spec;
        this.base = base;
        this.forceNew = forceNew;
    };

    function unwrapType(type, self, args) {
        return type.call ? type(self, args) : type;
    }

    function extractProp(type, prop) {
        if (prop == "!ret") {
            if (type.retval) return type.retval;
            var rv = new infer.AVal;
            type.propagate(new infer.IsCallee(infer.ANull, [], null, rv));
            return rv;
        }
        else {
            return type.getProp(prop);
        }
    }

    function computedFunc(args, retType) {
        return function(self, cArgs) {
            var realArgs = [];
            for (var i = 0; i < args.length; i++) realArgs.push(unwrapType(args[i], self, cArgs));
            return new infer.Fn(name, infer.ANull, realArgs, unwrapType(retType, self, cArgs));
        };
    }

    function computedUnion(types) {
        return function(self, args) {
            var union = new infer.AVal;
            for (var i = 0; i < types.length; i++) unwrapType(types[i], self, args).propagate(union);
            return union;
        };
    }

    function computedArray(inner) {
        return function(self, args) {
            return new infer.Arr(inner(self, args));
        };
    }

    TypeParser.prototype = {
        eat: function(str) {
            if (str.length == 1 ? this.spec.charAt(this.pos) == str : this.spec.indexOf(str, this.pos) == this.pos) {
                this.pos += str.length;
                return true;
            }
        },
        word: function(re) {
            var word = "",
                ch, re = re || /[\w$]/;
            while ((ch = this.spec.charAt(this.pos)) && re.test(ch)) {
                word += ch;
                ++this.pos;
            }
            return word;
        },
        error: function() {
            throw new Error("Unrecognized type spec: " + this.spec + " (at " + this.pos + ")");
        },
        parseFnType: function(comp, name, top) {
            var args = [],
                names = [],
                computed = false;
            if (!this.eat(")")) for (var i = 0;; ++i) {
                var colon = this.spec.indexOf(": ", this.pos),
                    argname;
                if (colon != -1) {
                    argname = this.spec.slice(this.pos, colon);
                    if (/^[$\w?]+$/.test(argname)) this.pos = colon + 2;
                    else argname = null;
                }
                names.push(argname);
                var argType = this.parseType(comp);
                if (argType.call) computed = true;
                args.push(argType);
                if (!this.eat(", ")) {
                    this.eat(")") || this.error();
                    break;
                }
            }
            var retType, computeRet, computeRetStart, fn;
            if (this.eat(" -> ")) {
                var retStart = this.pos;
                retType = this.parseType(true);
                if (retType.call) {
                    if (top) {
                        computeRet = retType;
                        retType = infer.ANull;
                        computeRetStart = retStart;
                    }
                    else {
                        computed = true;
                    }
                }
            }
            else {
                retType = infer.ANull;
            }
            if (computed) return computedFunc(args, retType);

            if (top && (fn = this.base)) infer.Fn.call(this.base, name, infer.ANull, args, names, retType);
            else fn = new infer.Fn(name, infer.ANull, args, names, retType);
            if (computeRet) fn.computeRet = computeRet;
            if (computeRetStart != null) fn.computeRetSource = this.spec.slice(computeRetStart, this.pos);
            return fn;
        },
        parseType: function(comp, name, top) {
            var main = this.parseTypeMaybeProp(comp, name, top);
            if (!this.eat("|")) return main;
            var types = [main],
                computed = main.call;
            for (;;) {
                var next = this.parseTypeMaybeProp(comp, name, top);
                types.push(next);
                if (next.call) computed = true;
                if (!this.eat("|")) break;
            }
            if (computed) return computedUnion(types);
            var union = new infer.AVal;
            for (var i = 0; i < types.length; i++) types[i].propagate(union);
            return union;
        },
        parseTypeMaybeProp: function(comp, name, top) {
            var result = this.parseTypeInner(comp, name, top);
            while (comp && this.eat(".")) result = this.extendWithProp(result);
            return result;
        },
        extendWithProp: function(base) {
            var propName = this.word(/[\w<>$!]/) || this.error();
            if (base.apply) return function(self, args) {
                return extractProp(base(self, args), propName);
            };
            return extractProp(base, propName);
        },
        parseTypeInner: function(comp, name, top) {
            if (this.eat("fn(")) {
                return this.parseFnType(comp, name, top);
            }
            else if (this.eat("[")) {
                var inner = this.parseType(comp);
                this.eat("]") || this.error();
                if (inner.call) return computedArray(inner);
                if (top && this.base) {
                    infer.Arr.call(this.base, inner);
                    return this.base;
                }
                return new infer.Arr(inner);
            }
            else if (this.eat("+")) {
                var path = this.word(/[\w$<>\.!]/);
                var base = parsePath(path + ".prototype");
                var type;
                if (!(base instanceof infer.Obj)) base = parsePath(path);
                if (!(base instanceof infer.Obj)) return base;
                if (comp && this.eat("[")) return this.parsePoly(base);
                if (top && this.forceNew) return new infer.Obj(base);
                return infer.getInstance(base);
            }
            else if (comp && this.eat("!")) {
                var arg = this.word(/\d/);
                if (arg) {
                    arg = Number(arg);
                    return function(_self, args) {
                        return args[arg] || infer.ANull;
                    };
                }
                else if (this.eat("this")) {
                    return function(self) {
                        return self;
                    };
                }
                else if (this.eat("custom:")) {
                    var fname = this.word(/[\w$]/);
                    return customFunctions[fname] || function() {
                        return infer.ANull;
                    };
                }
                else {
                    return this.fromWord("!" + this.word(/[\w$<>\.!]/));
                }
            }
            else if (this.eat("?")) {
                return infer.ANull;
            }
            else {
                return this.fromWord(this.word(/[\w$<>\.!`]/));
            }
        },
        fromWord: function(spec) {
            var cx = infer.cx();
            switch (spec) {
            case "number":
                return cx.num;
            case "string":
                return cx.str;
            case "bool":
                return cx.bool;
            case "<top>":
                return cx.topScope;
            }
            if (cx.localDefs && spec in cx.localDefs) return cx.localDefs[spec];
            return parsePath(spec);
        },
        parsePoly: function(base) {
            var propName = "<i>",
                match;
            if (match = this.spec.slice(this.pos).match(/^\s*(\w+)\s*=\s*/)) {
                propName = match[1];
                this.pos += match[0].length;
            }
            var value = this.parseType(true);
            if (!this.eat("]")) this.error();
            if (value.call) return function(self, args) {
                var instance = infer.getInstance(base);
                value(self, args).propagate(instance.defProp(propName));
                return instance;
            };
            var instance = infer.getInstance(base);
            value.propagate(instance.defProp(propName));
            return instance;
        }
    };

    function parseType(spec, name, base, forceNew) {
        var type = new TypeParser(spec, null, base, forceNew).parseType(false, name, true);
        if (/^fn\(/.test(spec)) for (var i = 0; i < type.args.length; ++i)(function(i) {
            var arg = type.args[i];
            if (arg instanceof infer.Fn && arg.args && arg.args.length) addEffect(type, function(_self, fArgs) {
                var fArg = fArgs[i];
                if (fArg) fArg.propagate(new infer.IsCallee(infer.cx().topScope, arg.args, null, infer.ANull));
            });
        })(i);
        return type;
    }

    function addEffect(fn, handler, replaceRet) {
        var oldCmp = fn.computeRet,
            rv = fn.retval;
        fn.computeRet = function(self, args, argNodes) {
            var handled = handler(self, args, argNodes);
            var old = oldCmp ? oldCmp(self, args, argNodes) : rv;
            return replaceRet ? handled : old;
        };
    }

    var parseEffect = exports.parseEffect = function(effect, fn) {
        var m;
        if (effect.indexOf("propagate ") == 0) {
            var p = new TypeParser(effect, 10);
            var origin = p.parseType(true);
            if (!p.eat(" ")) p.error();
            var target = p.parseType(true);
            addEffect(fn, function(self, args) {
                unwrapType(origin, self, args).propagate(unwrapType(target, self, args));
            });
        }
        else if (effect.indexOf("call ") == 0) {
            var andRet = effect.indexOf("and return ", 5) == 5;
            var p = new TypeParser(effect, andRet ? 16 : 5);
            var getCallee = p.parseType(true),
                getSelf = null,
                getArgs = [];
            if (p.eat(" this=")) getSelf = p.parseType(true);
            while (p.eat(" ")) getArgs.push(p.parseType(true));
            addEffect(fn, function(self, args) {
                var callee = unwrapType(getCallee, self, args);
                var slf = getSelf ? unwrapType(getSelf, self, args) : infer.ANull,
                    as = [];
                for (var i = 0; i < getArgs.length; ++i) as.push(unwrapType(getArgs[i], self, args));
                var result = andRet ? new infer.AVal : infer.ANull;
                callee.propagate(new infer.IsCallee(slf, as, null, result));
                return result;
            }, andRet);
        }
        else if (m = effect.match(/^custom (\S+)\s*(.*)/)) {
            var customFunc = customFunctions[m[1]];
            if (customFunc) addEffect(fn, m[2] ? customFunc(m[2]) : customFunc);
        }
        else if (effect.indexOf("copy ") == 0) {
            var p = new TypeParser(effect, 5);
            var getFrom = p.parseType(true);
            p.eat(" ");
            var getTo = p.parseType(true);
            addEffect(fn, function(self, args) {
                var from = unwrapType(getFrom, self, args),
                    to = unwrapType(getTo, self, args);
                from.forAllProps(function(prop, val, local) {
                    if (local && prop != "<i>") to.propagate(new infer.PropHasSubset(prop, val));
                });
            });
        }
        else {
            throw new Error("Unknown effect type: " + effect);
        }
    };

    var currentTopScope;

    var parsePath = exports.parsePath = function(path, scope) {
        var cx = infer.cx(),
            cached = cx.paths[path],
            origPath = path;
        if (cached != null) return cached;
        cx.paths[path] = infer.ANull;

        var base = scope || currentTopScope || cx.topScope;

        if (cx.localDefs) for (var name in cx.localDefs) {
            if (path.indexOf(name) == 0) {
                if (path == name) return cx.paths[path] = cx.localDefs[path];
                if (path.charAt(name.length) == ".") {
                    base = cx.localDefs[name];
                    path = path.slice(name.length + 1);
                    break;
                }
            }
        }

        var parts = path.split(".");
        for (var i = 0; i < parts.length && base != infer.ANull; ++i) {
            var prop = parts[i];
            if (prop.charAt(0) == "!") {
                if (prop == "!proto") {
                    base = (base instanceof infer.Obj && base.proto) || infer.ANull;
                }
                else {
                    var fn = base.getFunctionType();
                    if (!fn) {
                        base = infer.ANull;
                    }
                    else if (prop == "!ret") {
                        base = fn.retval && fn.retval.getType(false) || infer.ANull;
                    }
                    else {
                        var arg = fn.args && fn.args[Number(prop.slice(1))];
                        base = (arg && arg.getType(false)) || infer.ANull;
                    }
                }
            }
            else if (base instanceof infer.Obj) {
                var propVal = (prop == "prototype" && base instanceof infer.Fn) ? base.getProp(prop) : base.props[prop];
                if (!propVal || propVal.isEmpty()) base = infer.ANull;
                else base = propVal.types[0];
            }
        }
        // Uncomment this to get feedback on your poorly written .json files
        // if (base == infer.ANull) console.error("bad path: " + origPath + " (" + cx.curOrigin + ")");
        cx.paths[origPath] = base == infer.ANull ? null : base;
        return base;
    };

    function emptyObj(ctor) {
        var empty = Object.create(ctor.prototype);
        empty.props = Object.create(null);
        empty.isShell = true;
        return empty;
    }

    function isSimpleAnnotation(spec) {
        if (!spec["!type"] || /^(fn\(|\[)/.test(spec["!type"])) return false;
        for (var prop in spec)
        if (prop != "!type" && prop != "!doc" && prop != "!url" && prop != "!span" && prop != "!data") return false;
        return true;
    }

    function passOne(base, spec, path) {
        if (!base) {
            var tp = spec["!type"];
            if (tp) {
                if (/^fn\(/.test(tp)) base = emptyObj(infer.Fn);
                else if (tp.charAt(0) == "[") base = emptyObj(infer.Arr);
                else throw new Error("Invalid !type spec: " + tp);
            }
            else if (spec["!stdProto"]) {
                base = infer.cx().protos[spec["!stdProto"]];
            }
            else {
                base = emptyObj(infer.Obj);
            }
            base.name = path;
        }

        for (var name in spec) if (hop(spec, name) && name.charCodeAt(0) != 33) {
            var inner = spec[name];
            if (typeof inner == "string" || isSimpleAnnotation(inner)) continue;
            var prop = base.defProp(name);
            passOne(prop.getObjType(), inner, path ? path + "." + name : name).propagate(prop);
        }
        return base;
    }

    function passTwo(base, spec, path) {
        if (base.isShell) {
            delete base.isShell;
            var tp = spec["!type"];
            if (tp) {
                parseType(tp, path, base);
            }
            else {
                var proto = spec["!proto"] && parseType(spec["!proto"]);
                infer.Obj.call(base, proto instanceof infer.Obj ? proto : true, path);
            }
        }

        var effects = spec["!effects"];
        if (effects && base instanceof infer.Fn) for (var i = 0; i < effects.length; ++i)
        parseEffect(effects[i], base);
        copyInfo(spec, base);

        for (var name in spec) if (hop(spec, name) && name.charCodeAt(0) != 33) {
            var inner = spec[name],
                known = base.defProp(name),
                innerPath = path ? path + "." + name : name;
            if (typeof inner == "string") {
                if (known.isEmpty()) parseType(inner, innerPath).propagate(known);
            }
            else {
                if (!isSimpleAnnotation(inner)) passTwo(known.getObjType(), inner, innerPath);
                else if (known.isEmpty()) parseType(inner["!type"], innerPath, null, true).propagate(known);
                else continue;
                if (inner["!doc"]) known.doc = inner["!doc"];
                if (inner["!url"]) known.url = inner["!url"];
                if (inner["!span"]) known.span = inner["!span"];
            }
        }
        return base;
    }

    function copyInfo(spec, type) {
        if (spec["!doc"]) type.doc = spec["!doc"];
        if (spec["!url"]) type.url = spec["!url"];
        if (spec["!span"]) type.span = spec["!span"];
        if (spec["!data"]) type.metaData = spec["!data"];
    }

    function runPasses(type, arg) {
        var parent = infer.cx().parent,
            pass = parent && parent.passes && parent.passes[type];
        if (pass) for (var i = 0; i < pass.length; i++) pass[i](arg);
    }

    function doLoadEnvironment(data, scope) {
        var cx = infer.cx();

        infer.addOrigin(cx.curOrigin = data["!name"] || "env#" + cx.origins.length);
        cx.localDefs = cx.definitions[cx.curOrigin] = Object.create(null);

        runPasses("preLoadDef", data);

        passOne(scope, data);

        var def = data["!define"];
        if (def) {
            for (var name in def) {
                var spec = def[name];
                cx.localDefs[name] = typeof spec == "string" ? parsePath(spec) : passOne(null, spec, name);
            }
            for (var name in def) {
                var spec = def[name];
                if (typeof spec != "string") passTwo(cx.localDefs[name], def[name], name);
            }
        }

        passTwo(scope, data);

        runPasses("postLoadDef", data);

        cx.curOrigin = cx.localDefs = null;
    }

    exports.load = function(data, scope) {
        if (!scope) scope = infer.cx().topScope;
        var oldScope = currentTopScope;
        currentTopScope = scope;
        try {
            doLoadEnvironment(data, scope);
        }
        finally {
            currentTopScope = oldScope;
        }
    };

    exports.parse = function(data, origin, path) {
        var cx = infer.cx();
        if (origin) {
            cx.origin = origin;
            cx.localDefs = cx.definitions[origin];
        }

        try {
            if (typeof data == "string") return parseType(data, path);
            else return passTwo(passOne(null, data, path), data, path);
        }
        finally {
            if (origin) cx.origin = cx.localDefs = null;
        }
    };

    // Used to register custom logic for more involved effect or type
    // computation.
    var customFunctions = Object.create(null);
    infer.registerFunction = function(name, f) {
        customFunctions[name] = f;
    };

    var IsCreated = infer.constraint("created, target, spec", {
        addType: function(tp) {
            if (tp instanceof infer.Obj && this.created++ < 5) {
                var derived = new infer.Obj(tp),
                    spec = this.spec;
                if (spec instanceof infer.AVal) spec = spec.getObjType(false);
                if (spec instanceof infer.Obj) for (var prop in spec.props) {
                    var cur = spec.props[prop].types[0];
                    var p = derived.defProp(prop);
                    if (cur && cur instanceof infer.Obj && cur.props.value) {
                        var vtp = cur.props.value.getType(false);
                        if (vtp) p.addType(vtp);
                    }
                }
                this.target.addType(derived);
            }
        }
    });

    infer.registerFunction("Object_create", function(_self, args, argNodes) {
        if (argNodes && argNodes.length && argNodes[0].type == "Literal" && argNodes[0].value == null) return new infer.Obj();

        var result = new infer.AVal;
        if (args[0]) args[0].propagate(new IsCreated(0, result, args[1]));
        return result;
    });

    var PropSpec = infer.constraint("target", {
        addType: function(tp) {
            if (!(tp instanceof infer.Obj)) return;
            if (tp.hasProp("value")) tp.getProp("value").propagate(this.target);
            else if (tp.hasProp("get")) tp.getProp("get").propagate(new infer.IsCallee(infer.ANull, [], null, this.target));
        }
    });

    infer.registerFunction("Object_defineProperty", function(_self, args, argNodes) {
        if (argNodes && argNodes.length >= 3 && argNodes[1].type == "Literal" && typeof argNodes[1].value == "string") {
            var obj = args[0],
                connect = new infer.AVal;
            obj.propagate(new infer.PropHasSubset(argNodes[1].value, connect, argNodes[1]));
            args[2].propagate(new PropSpec(connect));
        }
        return infer.ANull;
    });

    var IsBound = infer.constraint("self, args, target", {
        addType: function(tp) {
            if (!(tp instanceof infer.Fn)) return;
            this.target.addType(new infer.Fn(tp.name, tp.self, tp.args.slice(this.args.length),
            tp.argNames.slice(this.args.length), tp.retval));
            this.self.propagate(tp.self);
            for (var i = 0; i < Math.min(tp.args.length, this.args.length); ++i)
            this.args[i].propagate(tp.args[i]);
        }
    });

    infer.registerFunction("Function_bind", function(self, args) {
        if (!args.length) return infer.ANull;
        var result = new infer.AVal;
        self.propagate(new IsBound(args[0], args.slice(1), result));
        return result;
    });

    infer.registerFunction("Array_ctor", function(_self, args) {
        var arr = new infer.Arr;
        if (args.length != 1 || !args[0].hasType(infer.cx().num)) {
            var content = arr.getProp("<i>");
            for (var i = 0; i < args.length; ++i) args[i].propagate(content);
        }
        return arr;
    });

    infer.registerFunction("Promise_ctor", function(_self, args, argNodes) {
        if (args.length < 1) return infer.ANull;
        var self = new infer.Obj(infer.cx().definitions.ecma6["Promise.prototype"]);
        var valProp = self.defProp("value", argNodes && argNodes[0]);
        var valArg = new infer.AVal;
        valArg.propagate(valProp);
        var exec = new infer.Fn("execute", infer.ANull, [valArg], ["value"], infer.ANull);
        var reject = infer.cx().definitions.ecma6.promiseReject;
        args[0].propagate(new infer.IsCallee(infer.ANull, [exec, reject], null, infer.ANull));
        return self;
    });

    return exports;
});

//#endregion


//#region tern/lib/infer.js

// Main type inference engine

// Walks an AST, building up a graph of abstract values and constraints
// that cause types to flow from one node to another. Also defines a
// number of utilities for accessing ASTs and scopes.

// Analysis is done in a context, which is tracked by the dynamically
// bound cx variable. Use withContext to set the current context.

// For memory-saving reasons, individual types export an interface
// similar to abstract values (which can hold multiple types), and can
// thus be used in place abstract values that only ever contain a
// single type.

(function(root, mod) {
    if (typeof exports == "object" && typeof module == "object") // CommonJS
    return mod(exports, require("acorn"), require("acorn/dist/acorn_loose"), require("acorn/dist/walk"),
    require("./def"), require("./signal"));
    if (typeof define == "function" && define.amd) // AMD
    return define(["exports", "acorn/dist/acorn", "acorn/dist/acorn_loose", "acorn/dist/walk", "./def", "./signal"], mod);
    mod(root.tern || (root.tern = {}), acorn, acorn, acorn.walk, tern.def, tern.signal); // Plain browser env
})(this, function(exports, acorn, acorn_loose, walk, def, signal) {
    "use strict";

    var toString = exports.toString = function(type, maxDepth, parent) {
        return !type || type == parent ? "?" : type.toString(maxDepth, parent);
    };

    // A variant of AVal used for unknown, dead-end values. Also serves
    // as prototype for AVals, Types, and Constraints because it
    // implements 'empty' versions of all the methods that the code
    // expects.
    var ANull = exports.ANull = signal.mixin({
        addType: function() {},
        propagate: function() {},
        getProp: function() {
            return ANull;
        },
        forAllProps: function() {},
        hasType: function() {
            return false;
        },
        isEmpty: function() {
            return true;
        },
        getFunctionType: function() {},
        getObjType: function() {},
        getType: function() {},
        gatherProperties: function() {},
        propagatesTo: function() {},
        typeHint: function() {},
        propHint: function() {},
        toString: function() {
            return "?";
        }
    });

    function extend(proto, props) {
        var obj = Object.create(proto);
        if (props) for (var prop in props) obj[prop] = props[prop];
        return obj;
    }

    // ABSTRACT VALUES

    var WG_DEFAULT = 100,
        WG_NEW_INSTANCE = 90,
        WG_MADEUP_PROTO = 10,
        WG_MULTI_MEMBER = 5,
        WG_CATCH_ERROR = 5,
        WG_GLOBAL_THIS = 90,
        WG_SPECULATIVE_THIS = 2;

    var AVal = exports.AVal = function() {
        this.types = [];
        this.forward = null;
        this.maxWeight = 0;
    };
    AVal.prototype = extend(ANull, {
        addType: function(type, weight) {
            weight = weight || WG_DEFAULT;
            if (this.maxWeight < weight) {
                this.maxWeight = weight;
                if (this.types.length == 1 && this.types[0] == type) return;
                this.types.length = 0;
            }
            else if (this.maxWeight > weight || this.types.indexOf(type) > -1) {
                return;
            }

            this.signal("addType", type);
            this.types.push(type);
            var forward = this.forward;
            if (forward) withWorklist(function(add) {
                for (var i = 0; i < forward.length; ++i) add(type, forward[i], weight);
            });
        },

        propagate: function(target, weight) {
            if (target == ANull || (target instanceof Type && this.forward && this.forward.length > 2)) return;
            if (weight && weight != WG_DEFAULT) target = new Muffle(target, weight);
            (this.forward || (this.forward = [])).push(target);
            var types = this.types;
            if (types.length) withWorklist(function(add) {
                for (var i = 0; i < types.length; ++i) add(types[i], target, weight);
            });
        },

        getProp: function(prop) {
            if (prop == "__proto__" || prop == "✖") return ANull;
            var found = (this.props || (this.props = Object.create(null)))[prop];
            if (!found) {
                found = this.props[prop] = new AVal;
                this.propagate(new PropIsSubset(prop, found));
            }
            return found;
        },

        forAllProps: function(c) {
            this.propagate(new ForAllProps(c));
        },

        hasType: function(type) {
            return this.types.indexOf(type) > -1;
        },
        isEmpty: function() {
            return this.types.length === 0;
        },
        getFunctionType: function() {
            for (var i = this.types.length - 1; i >= 0; --i)
            if (this.types[i] instanceof Fn) return this.types[i];
        },
        getObjType: function() {
            var seen = null;
            for (var i = this.types.length - 1; i >= 0; --i) {
                var type = this.types[i];
                if (!(type instanceof Obj)) continue;
                if (type.name) return type;
                if (!seen) seen = type;
            }
            return seen;
        },

        getType: function(guess) {
            if (this.types.length === 0 && guess !== false) return this.makeupType();
            if (this.types.length === 1) return this.types[0];
            return canonicalType(this.types);
        },

        toString: function(maxDepth, parent) {
            if (this.types.length == 0) return toString(this.makeupType(), maxDepth, parent);
            if (this.types.length == 1) return toString(this.types[0], maxDepth, parent);
            var simplified = simplifyTypes(this.types);
            if (simplified.length > 2) return "?";
            return simplified.map(function(tp) {
                return toString(tp, maxDepth, parent);
            }).join("|");
        },

        computedPropType: function() {
            if (!this.propertyOf || !this.propertyOf.hasProp("<i>")) return null;
            var computedProp = this.propertyOf.getProp("<i>");
            if (computedProp == this) return null;
            return computedProp.getType();
        },

        makeupType: function() {
            var computed = this.computedPropType();
            if (computed) return computed;

            if (!this.forward) return null;
            for (var i = this.forward.length - 1; i >= 0; --i) {
                var hint = this.forward[i].typeHint();
                if (hint && !hint.isEmpty()) {
                    guessing = true;
                    return hint;
                }
            }

            var props = Object.create(null),
                foundProp = null;
            for (var i = 0; i < this.forward.length; ++i) {
                var prop = this.forward[i].propHint();
                if (prop && prop != "length" && prop != "<i>" && prop != "✖" && prop != cx.completingProperty) {
                    props[prop] = true;
                    foundProp = prop;
                }
            }
            if (!foundProp) return null;

            var objs = objsWithProp(foundProp);
            if (objs) {
                var matches = [];
                search: for (var i = 0; i < objs.length; ++i) {
                    var obj = objs[i];
                    for (var prop in props) if (!obj.hasProp(prop)) continue search;
                    if (obj.hasCtor) obj = getInstance(obj);
                    matches.push(obj);
                }
                var canon = canonicalType(matches);
                if (canon) {
                    guessing = true;
                    return canon;
                }
            }
        },

        typeHint: function() {
            return this.types.length ? this.getType() : null;
        },
        propagatesTo: function() {
            return this;
        },

        gatherProperties: function(f, depth) {
            for (var i = 0; i < this.types.length; ++i)
            this.types[i].gatherProperties(f, depth);
        },

        guessProperties: function(f) {
            if (this.forward) for (var i = 0; i < this.forward.length; ++i) {
                var prop = this.forward[i].propHint();
                if (prop) f(prop, null, 0);
            }
            var guessed = this.makeupType();
            if (guessed) guessed.gatherProperties(f);
        }
    });

    function similarAVal(a, b, depth) {
        var typeA = a.getType(false),
            typeB = b.getType(false);
        if (!typeA || !typeB) return true;
        return similarType(typeA, typeB, depth);
    }

    function similarType(a, b, depth) {
        if (!a || depth >= 5) return b;
        if (!a || a == b) return a;
        if (!b) return a;
        if (a.constructor != b.constructor) return false;
        if (a.constructor == Arr) {
            var innerA = a.getProp("<i>").getType(false);
            if (!innerA) return b;
            var innerB = b.getProp("<i>").getType(false);
            if (!innerB || similarType(innerA, innerB, depth + 1)) return b;
        }
        else if (a.constructor == Obj) {
            var propsA = 0,
                propsB = 0,
                same = 0;
            for (var prop in a.props) {
                propsA++;
                if (prop in b.props && similarAVal(a.props[prop], b.props[prop], depth + 1)) same++;
            }
            for (var prop in b.props) propsB++;
            if (propsA && propsB && same < Math.max(propsA, propsB) / 2) return false;
            return propsA > propsB ? a : b;
        }
        else if (a.constructor == Fn) {
            if (a.args.length != b.args.length || !a.args.every(function(tp, i) {
                return similarAVal(tp, b.args[i], depth + 1);
            }) || !similarAVal(a.retval, b.retval, depth + 1) || !similarAVal(a.self, b.self, depth + 1)) return false;
            return a;
        }
        else {
            return false;
        }
    }

    var simplifyTypes = exports.simplifyTypes = function(types) {
        var found = [];
        outer: for (var i = 0; i < types.length; ++i) {
            var tp = types[i];
            for (var j = 0; j < found.length; j++) {
                var similar = similarType(tp, found[j], 0);
                if (similar) {
                    found[j] = similar;
                    continue outer;
                }
            }
            found.push(tp);
        }
        return found;
    };

    function canonicalType(types) {
        var arrays = 0,
            fns = 0,
            objs = 0,
            prim = null;
        for (var i = 0; i < types.length; ++i) {
            var tp = types[i];
            if (tp instanceof Arr)++arrays;
            else if (tp instanceof Fn)++fns;
            else if (tp instanceof Obj)++objs;
            else if (tp instanceof Prim) {
                if (prim && tp.name != prim.name) return null;
                prim = tp;
            }
        }
        var kinds = (arrays && 1) + (fns && 1) + (objs && 1) + (prim && 1);
        if (kinds > 1) return null;
        if (prim) return prim;

        var maxScore = 0,
            maxTp = null;
        for (var i = 0; i < types.length; ++i) {
            var tp = types[i],
                score = 0;
            if (arrays) {
                score = tp.getProp("<i>").isEmpty() ? 1 : 2;
            }
            else if (fns) {
                score = 1;
                for (var j = 0; j < tp.args.length; ++j) if (!tp.args[j].isEmpty())++score;
                if (!tp.retval.isEmpty())++score;
            }
            else if (objs) {
                score = tp.name ? 100 : 2;
            }
            if (score >= maxScore) {
                maxScore = score;
                maxTp = tp;
            }
        }
        return maxTp;
    }

    // PROPAGATION STRATEGIES

    function Constraint() {}
    Constraint.prototype = extend(ANull, {
        init: function() {
            this.origin = cx.curOrigin;
        }
    });

    var constraint = exports.constraint = function(props, methods) {
        var body = "this.init();";
        props = props ? props.split(", ") : [];

        //for (var i = 0; i < props.length; ++i)
        //body += "this." + props[i] + " = " + props[i] + ";";
        //var ctor = Function.apply(null, props.concat([body]));

        var ctor = function() {
            for(var i = 0; i < props.length; ++i)
            {
                this[props[i]] = arguments[i];
            }
            this.init();
        };

        ctor.prototype = Object.create(Constraint.prototype);
        for (var m in methods) if (methods.hasOwnProperty(m)) ctor.prototype[m] = methods[m];
        return ctor;
    };

    var PropIsSubset = constraint("prop, target", {
        addType: function(type, weight) {
            if (type.getProp) type.getProp(this.prop).propagate(this.target, weight);
        },
        propHint: function() {
            return this.prop;
        },
        propagatesTo: function() {
            if (this.prop == "<i>" || !/[^\w_]/.test(this.prop)) return {
                target: this.target,
                pathExt: "." + this.prop
            };
        }
    });

    var PropHasSubset = exports.PropHasSubset = constraint("prop, type, originNode", {
        addType: function(type, weight) {
            if (!(type instanceof Obj)) return;
            var prop = type.defProp(this.prop, this.originNode);
            prop.origin = this.origin;
            this.type.propagate(prop, weight);
        },
        propHint: function() {
            return this.prop;
        }
    });

    var ForAllProps = constraint("c", {
        addType: function(type) {
            if (!(type instanceof Obj)) return;
            type.forAllProps(this.c);
        }
    });

    function withDisabledComputing(fn, body) {
        cx.disabledComputing = {
            fn: fn,
            prev: cx.disabledComputing
        };
        try {
            return body();
        }
        finally {
            cx.disabledComputing = cx.disabledComputing.prev;
        }
    }
    var IsCallee = exports.IsCallee = constraint("self, args, argNodes, retval", {
        init: function() {
            Constraint.prototype.init.call(this);
            this.disabled = cx.disabledComputing;
        },
        addType: function(fn, weight) {
            if (!(fn instanceof Fn)) return;
            for (var i = 0; i < this.args.length; ++i) {
                if (i < fn.args.length) this.args[i].propagate(fn.args[i], weight);
                if (fn.arguments) this.args[i].propagate(fn.arguments, weight);
            }
            this.self.propagate(fn.self, this.self == cx.topScope ? WG_GLOBAL_THIS : weight);
            var compute = fn.computeRet;
            if (compute) for (var d = this.disabled; d; d = d.prev)
            if (d.fn == fn || fn.originNode && d.fn.originNode == fn.originNode) compute = null;
            if (compute) compute(this.self, this.args, this.argNodes).propagate(this.retval, weight);
            else fn.retval.propagate(this.retval, weight);
        },
        typeHint: function() {
            var names = [];
            for (var i = 0; i < this.args.length; ++i) names.push("?");
            return new Fn(null, this.self, this.args, names, ANull);
        },
        propagatesTo: function() {
            return {
                target: this.retval,
                pathExt: ".!ret"
            };
        }
    });

    var HasMethodCall = constraint("propName, args, argNodes, retval", {
        init: function() {
            Constraint.prototype.init.call(this);
            this.disabled = cx.disabledComputing;
        },
        addType: function(obj, weight) {
            var callee = new IsCallee(obj, this.args, this.argNodes, this.retval);
            callee.disabled = this.disabled;
            obj.getProp(this.propName).propagate(callee, weight);
        },
        propHint: function() {
            return this.propName;
        }
    });

    var IsCtor = exports.IsCtor = constraint("target, noReuse", {
        addType: function(f, weight) {
            if (!(f instanceof Fn)) return;
            if (cx.parent && !cx.parent.options.reuseInstances) this.noReuse = true;
            f.getProp("prototype").propagate(new IsProto(this.noReuse ? false : f, this.target), weight);
        }
    });

    var getInstance = exports.getInstance = function(obj, ctor) {
        if (ctor === false) return new Obj(obj);

        if (!ctor) ctor = obj.hasCtor;
        if (!obj.instances) obj.instances = [];
        for (var i = 0; i < obj.instances.length; ++i) {
            var cur = obj.instances[i];
            if (cur.ctor == ctor) return cur.instance;
        }
        var instance = new Obj(obj, ctor && ctor.name);
        instance.origin = obj.origin;
        obj.instances.push({
            ctor: ctor,
            instance: instance
        });
        return instance;
    };

    var IsProto = exports.IsProto = constraint("ctor, target", {
        addType: function(o, _weight) {
            if (!(o instanceof Obj)) return;
            if ((this.count = (this.count || 0) + 1) > 8) return;
            if (o == cx.protos.Array) this.target.addType(new Arr);
            else this.target.addType(getInstance(o, this.ctor));
        }
    });

    var FnPrototype = constraint("fn", {
        addType: function(o, _weight) {
            if (o instanceof Obj && !o.hasCtor) {
                o.hasCtor = this.fn;
                var adder = new SpeculativeThis(o, this.fn);
                adder.addType(this.fn);
                o.forAllProps(function(_prop, val, local) {
                    if (local) val.propagate(adder);
                });
            }
        }
    });

    var IsAdded = constraint("other, target", {
        addType: function(type, weight) {
            if (type == cx.str) this.target.addType(cx.str, weight);
            else if (type == cx.num && this.other.hasType(cx.num)) this.target.addType(cx.num, weight);
        },
        typeHint: function() {
            return this.other;
        }
    });

    var IfObj = exports.IfObj = constraint("target", {
        addType: function(t, weight) {
            if (t instanceof Obj) this.target.addType(t, weight);
        },
        propagatesTo: function() {
            return this.target;
        }
    });

    var SpeculativeThis = constraint("obj, ctor", {
        addType: function(tp) {
            if (tp instanceof Fn && tp.self && tp.self.isEmpty()) tp.self.addType(getInstance(this.obj, this.ctor), WG_SPECULATIVE_THIS);
        }
    });

    var Muffle = constraint("inner, weight", {
        addType: function(tp, weight) {
            this.inner.addType(tp, Math.min(weight, this.weight));
        },
        propagatesTo: function() {
            return this.inner.propagatesTo();
        },
        typeHint: function() {
            return this.inner.typeHint();
        },
        propHint: function() {
            return this.inner.propHint();
        }
    });

    // TYPE OBJECTS

    var Type = exports.Type = function() {};
    Type.prototype = extend(ANull, {
        constructor: Type,
        propagate: function(c, w) {
            c.addType(this, w);
        },
        hasType: function(other) {
            return other == this;
        },
        isEmpty: function() {
            return false;
        },
        typeHint: function() {
            return this;
        },
        getType: function() {
            return this;
        }
    });

    var Prim = exports.Prim = function(proto, name) {
        this.name = name;
        this.proto = proto;
    };
    Prim.prototype = extend(Type.prototype, {
        constructor: Prim,
        toString: function() {
            return this.name;
        },
        getProp: function(prop) {
            return this.proto.hasProp(prop) || ANull;
        },
        gatherProperties: function(f, depth) {
            if (this.proto) this.proto.gatherProperties(f, depth);
        }
    });

    var Obj = exports.Obj = function(proto, name) {
        if (!this.props) this.props = Object.create(null);
        this.proto = proto === true ? cx.protos.Object : proto;
        if (proto && !name && proto.name && !(this instanceof Fn)) {
            var match = /^(.*)\.prototype$/.exec(this.proto.name);
            if (match) name = match[1];
        }
        this.name = name;
        this.maybeProps = null;
        this.origin = cx.curOrigin;
    };
    Obj.prototype = extend(Type.prototype, {
        constructor: Obj,
        toString: function(maxDepth) {
            if (!maxDepth && this.name) return this.name;
            var props = [],
                etc = false;
            for (var prop in this.props) if (prop != "<i>") {
                if (props.length > 5) {
                    etc = true;
                    break;
                }
                if (maxDepth) props.push(prop + ": " + toString(this.props[prop], maxDepth - 1));
                else props.push(prop);
            }
            props.sort();
            if (etc) props.push("...");
            return "{" + props.join(", ") + "}";
        },
        hasProp: function(prop, searchProto) {
            var found = this.props[prop];
            if (searchProto !== false) for (var p = this.proto; p && !found; p = p.proto) found = p.props[prop];
            return found;
        },
        defProp: function(prop, originNode) {
            var found = this.hasProp(prop, false);
            if (found) {
                if (originNode && !found.originNode) found.originNode = originNode;
                return found;
            }
            if (prop == "__proto__" || prop == "✖") return ANull;

            var av = this.maybeProps && this.maybeProps[prop];
            if (av) {
                delete this.maybeProps[prop];
                this.maybeUnregProtoPropHandler();
            }
            else {
                av = new AVal;
                av.propertyOf = this;
            }

            this.props[prop] = av;
            av.originNode = originNode;
            av.origin = cx.curOrigin;
            this.broadcastProp(prop, av, true);
            return av;
        },
        getProp: function(prop) {
            var found = this.hasProp(prop, true) || (this.maybeProps && this.maybeProps[prop]);
            if (found) return found;
            if (prop == "__proto__" || prop == "✖") return ANull;
            var av = this.ensureMaybeProps()[prop] = new AVal;
            av.propertyOf = this;
            return av;
        },
        broadcastProp: function(prop, val, local) {
            if (local) {
                this.signal("addProp", prop, val);
                // If this is a scope, it shouldn't be registered
                if (!(this instanceof Scope)) registerProp(prop, this);
            }

            if (this.onNewProp) for (var i = 0; i < this.onNewProp.length; ++i) {
                var h = this.onNewProp[i];
                h.onProtoProp ? h.onProtoProp(prop, val, local) : h(prop, val, local);
            }
        },
        onProtoProp: function(prop, val, _local) {
            var maybe = this.maybeProps && this.maybeProps[prop];
            if (maybe) {
                delete this.maybeProps[prop];
                this.maybeUnregProtoPropHandler();
                this.proto.getProp(prop).propagate(maybe);
            }
            this.broadcastProp(prop, val, false);
        },
        ensureMaybeProps: function() {
            if (!this.maybeProps) {
                if (this.proto) this.proto.forAllProps(this);
                this.maybeProps = Object.create(null);
            }
            return this.maybeProps;
        },
        removeProp: function(prop) {
            var av = this.props[prop];
            delete this.props[prop];
            this.ensureMaybeProps()[prop] = av;
            av.types.length = 0;
        },
        forAllProps: function(c) {
            if (!this.onNewProp) {
                this.onNewProp = [];
                if (this.proto) this.proto.forAllProps(this);
            }
            this.onNewProp.push(c);
            for (var o = this; o; o = o.proto) for (var prop in o.props) {
                if (c.onProtoProp) c.onProtoProp(prop, o.props[prop], o == this);
                else c(prop, o.props[prop], o == this);
            }
        },
        maybeUnregProtoPropHandler: function() {
            if (this.maybeProps) {
                for (var _n in this.maybeProps) return;
                this.maybeProps = null;
            }
            if (!this.proto || this.onNewProp && this.onNewProp.length) return;
            this.proto.unregPropHandler(this);
        },
        unregPropHandler: function(handler) {
            for (var i = 0; i < this.onNewProp.length; ++i)
            if (this.onNewProp[i] == handler) {
                this.onNewProp.splice(i, 1);
                break;
            }
            this.maybeUnregProtoPropHandler();
        },
        gatherProperties: function(f, depth) {
            for (var prop in this.props) if (prop != "<i>") f(prop, this, depth);
            if (this.proto) this.proto.gatherProperties(f, depth + 1);
        },
        getObjType: function() {
            return this;
        }
    });

    var Fn = exports.Fn = function(name, self, args, argNames, retval) {
        Obj.call(this, cx.protos.Function, name);
        this.self = self;
        this.args = args;
        this.argNames = argNames;
        this.retval = retval;
    };
    Fn.prototype = extend(Obj.prototype, {
        constructor: Fn,
        toString: function(maxDepth) {
            if (maxDepth) maxDepth--;
            var str = "fn(";
            for (var i = 0; i < this.args.length; ++i) {
                if (i) str += ", ";
                var name = this.argNames[i];
                if (name && name != "?") str += name + ": ";
                str += toString(this.args[i], maxDepth, this);
            }
            str += ")";
            if (!this.retval.isEmpty()) str += " -> " + toString(this.retval, maxDepth, this);
            return str;
        },
        getProp: function(prop) {
            if (prop == "prototype") {
                var known = this.hasProp(prop, false);
                if (!known) {
                    known = this.defProp(prop);
                    var proto = new Obj(true, this.name && this.name + ".prototype");
                    proto.origin = this.origin;
                    known.addType(proto, WG_MADEUP_PROTO);
                }
                return known;
            }
            return Obj.prototype.getProp.call(this, prop);
        },
        defProp: function(prop, originNode) {
            if (prop == "prototype") {
                var found = this.hasProp(prop, false);
                if (found) return found;
                found = Obj.prototype.defProp.call(this, prop, originNode);
                found.origin = this.origin;
                found.propagate(new FnPrototype(this));
                return found;
            }
            return Obj.prototype.defProp.call(this, prop, originNode);
        },
        getFunctionType: function() {
            return this;
        }
    });

    var Arr = exports.Arr = function(contentType) {
        Obj.call(this, cx.protos.Array);
        var content = this.defProp("<i>");
        if (contentType) contentType.propagate(content);
    };
    Arr.prototype = extend(Obj.prototype, {
        constructor: Arr,
        toString: function(maxDepth) {
            return "[" + toString(this.getProp("<i>"), maxDepth, this) + "]";
        }
    });

    // THE PROPERTY REGISTRY

    function registerProp(prop, obj) {
        var data = cx.props[prop] || (cx.props[prop] = []);
        data.push(obj);
    }

    function objsWithProp(prop) {
        return cx.props[prop];
    }

    // INFERENCE CONTEXT

    exports.Context = function(defs, parent) {
        this.parent = parent;
        this.props = Object.create(null);
        this.protos = Object.create(null);
        this.origins = [];
        this.curOrigin = "ecma5";
        this.paths = Object.create(null);
        this.definitions = Object.create(null);
        this.purgeGen = 0;
        this.workList = null;
        this.disabledComputing = null;

        exports.withContext(this, function() {
            cx.protos.Object = new Obj(null, "Object.prototype");
            cx.topScope = new Scope();
            cx.topScope.name = "<top>";
            cx.protos.Array = new Obj(true, "Array.prototype");
            cx.protos.Function = new Obj(true, "Function.prototype");
            cx.protos.RegExp = new Obj(true, "RegExp.prototype");
            cx.protos.String = new Obj(true, "String.prototype");
            cx.protos.Number = new Obj(true, "Number.prototype");
            cx.protos.Boolean = new Obj(true, "Boolean.prototype");
            cx.str = new Prim(cx.protos.String, "string");
            cx.bool = new Prim(cx.protos.Boolean, "bool");
            cx.num = new Prim(cx.protos.Number, "number");
            cx.curOrigin = null;

            if (defs) for (var i = 0; i < defs.length; ++i)
            def.load(defs[i]);
        });
    };

    var cx = null;
    exports.cx = function() {
        return cx;
    };

    exports.withContext = function(context, f) {
        var old = cx;
        cx = context;
        try {
            return f();
        }
        finally {
            cx = old;
        }
    };

    exports.TimedOut = function() {
        this.message = "Timed out";
        this.stack = (new Error()).stack;
    };
    exports.TimedOut.prototype = Object.create(Error.prototype);
    exports.TimedOut.prototype.name = "infer.TimedOut";

    var timeout;
    exports.withTimeout = function(ms, f) {
        var end = +new Date + ms;
        var oldEnd = timeout;
        if (oldEnd && oldEnd < end) return f();
        timeout = end;
        try {
            return f();
        }
        finally {
            timeout = oldEnd;
        }
    };

    exports.addOrigin = function(origin) {
        if (cx.origins.indexOf(origin) < 0) cx.origins.push(origin);
    };

    var baseMaxWorkDepth = 20,
        reduceMaxWorkDepth = 0.0001;

    function withWorklist(f) {
        if (cx.workList) return f(cx.workList);

        var list = [],
            depth = 0;
        var add = cx.workList = function(type, target, weight) {
            if (depth < baseMaxWorkDepth - reduceMaxWorkDepth * list.length) list.push(type, target, weight, depth);
        };
        try {
            var ret = f(add);
            for (var i = 0; i < list.length; i += 4) {
                if (timeout && +new Date >= timeout) throw new exports.TimedOut();
                depth = list[i + 3] + 1;
                list[i + 1].addType(list[i], list[i + 2]);
            }
            return ret;
        }
        finally {
            cx.workList = null;
        }
    }

    // SCOPES

    var Scope = exports.Scope = function(prev) {
        Obj.call(this, prev || true);
        this.prev = prev;
    };
    Scope.prototype = extend(Obj.prototype, {
        constructor: Scope,
        defVar: function(name, originNode) {
            for (var s = this;; s = s.proto) {
                var found = s.props[name];
                if (found) return found;
                if (!s.prev) return s.defProp(name, originNode);
            }
        }
    });

    // RETVAL COMPUTATION HEURISTICS

    function maybeInstantiate(scope, score) {
        if (scope.fnType) scope.fnType.instantiateScore = (scope.fnType.instantiateScore || 0) + score;
    }

    var NotSmaller = {};

    function nodeSmallerThan(node, n) {
        try {
            walk.simple(node, {
                Expression: function() {
                    if (--n <= 0) throw NotSmaller;
                }
            });
            return true;
        }
        catch (e) {
            if (e == NotSmaller) return false;
            throw e;
        }
    }

    function maybeTagAsInstantiated(node, scope) {
        var score = scope.fnType.instantiateScore;
        if (!cx.disabledComputing && score && scope.fnType.args.length && nodeSmallerThan(node, score * 5)) {
            maybeInstantiate(scope.prev, score / 2);
            setFunctionInstantiated(node, scope);
            return true;
        }
        else {
            scope.fnType.instantiateScore = null;
        }
    }

    function setFunctionInstantiated(node, scope) {
        var fn = scope.fnType;
        // Disconnect the arg avals, so that we can add info to them without side effects
        for (var i = 0; i < fn.args.length; ++i) fn.args[i] = new AVal;
        fn.self = new AVal;
        fn.computeRet = function(self, args) {
            // Prevent recursion
            return withDisabledComputing(fn, function() {
                var oldOrigin = cx.curOrigin;
                cx.curOrigin = fn.origin;
                var scopeCopy = new Scope(scope.prev);
                scopeCopy.originNode = scope.originNode;
                for (var v in scope.props) {
                    var local = scopeCopy.defProp(v, scope.props[v].originNode);
                    for (var i = 0; i < args.length; ++i) if (fn.argNames[i] == v && i < args.length) args[i].propagate(local);
                }
                var argNames = fn.argNames.length != args.length ? fn.argNames.slice(0, args.length) : fn.argNames;
                while (argNames.length < args.length) argNames.push("?");
                scopeCopy.fnType = new Fn(fn.name, self, args, argNames, ANull);
                scopeCopy.fnType.originNode = fn.originNode;
                if (fn.arguments) {
                    var argset = scopeCopy.fnType.arguments = new AVal;
                    scopeCopy.defProp("arguments").addType(new Arr(argset));
                    for (var i = 0; i < args.length; ++i) args[i].propagate(argset);
                }
                node.body.scope = scopeCopy;
                walk.recursive(node.body, scopeCopy, null, scopeGatherer);
                walk.recursive(node.body, scopeCopy, null, inferWrapper);
                cx.curOrigin = oldOrigin;
                return scopeCopy.fnType.retval;
            });
        };
    }

    function maybeTagAsGeneric(scope) {
        var fn = scope.fnType,
            target = fn.retval;
        if (target == ANull) return;
        var targetInner, asArray;
        if (!target.isEmpty() && (targetInner = target.getType()) instanceof Arr) target = asArray = targetInner.getProp("<i>");

        function explore(aval, path, depth) {
            if (depth > 3 || !aval.forward) return;
            for (var i = 0; i < aval.forward.length; ++i) {
                var prop = aval.forward[i].propagatesTo();
                if (!prop) continue;
                var newPath = path,
                    dest;
                if (prop instanceof AVal) {
                    dest = prop;
                }
                else if (prop.target instanceof AVal) {
                    newPath += prop.pathExt;
                    dest = prop.target;
                }
                else continue;
                if (dest == target) return newPath;
                var found = explore(dest, newPath, depth + 1);
                if (found) return found;
            }
        }

        var foundPath = explore(fn.self, "!this", 0);
        for (var i = 0; !foundPath && i < fn.args.length; ++i)
        foundPath = explore(fn.args[i], "!" + i, 0);

        if (foundPath) {
            if (asArray) foundPath = "[" + foundPath + "]";
            var p = new def.TypeParser(foundPath);
            var parsed = p.parseType(true);
            fn.computeRet = parsed.apply ? parsed : function() {
                return parsed;
            };
            fn.computeRetSource = foundPath;
            return true;
        }
    }

    // SCOPE GATHERING PASS

    function addVar(scope, nameNode) {
        return scope.defProp(nameNode.name, nameNode);
    }

    var scopeGatherer = walk.make({
        Function: function(node, scope, c) {
            var inner = node.body.scope = new Scope(scope);
            inner.originNode = node;
            var argVals = [],
                argNames = [];
            for (var i = 0; i < node.params.length; ++i) {
                var param = node.params[i];
                argNames.push(param.name);
                argVals.push(addVar(inner, param));
            }
            inner.fnType = new Fn(node.id && node.id.name, new AVal, argVals, argNames, ANull);
            inner.fnType.originNode = node;
            if (node.id) {
                var decl = node.type == "FunctionDeclaration";
                addVar(decl ? scope : inner, node.id);
            }
            c(node.body, inner, "ScopeBody");
        },
        TryStatement: function(node, scope, c) {
            c(node.block, scope, "Statement");
            if (node.handler) {
                var v = addVar(scope, node.handler.param);
                c(node.handler.body, scope, "ScopeBody");
                var e5 = cx.definitions.ecma5;
                if (e5 && v.isEmpty()) getInstance(e5["Error.prototype"]).propagate(v, WG_CATCH_ERROR);
            }
            if (node.finalizer) c(node.finalizer, scope, "Statement");
        },
        VariableDeclaration: function(node, scope, c) {
            for (var i = 0; i < node.declarations.length; ++i) {
                var decl = node.declarations[i];
                addVar(scope, decl.id);
                if (decl.init) c(decl.init, scope, "Expression");
            }
        }
    });

    // CONSTRAINT GATHERING PASS

    function propName(node, scope, c) {
        var prop = node.property;
        if (!node.computed) return prop.name;
        if (prop.type == "Literal" && typeof prop.value == "string") return prop.value;
        if (c) infer(prop, scope, c, ANull);
        return "<i>";
    }

    function unopResultType(op) {
        switch (op) {
        case "+":
        case "-":
        case "~":
            return cx.num;
        case "!":
            return cx.bool;
        case "typeof":
            return cx.str;
        case "void":
        case "delete":
            return ANull;
        }
    }

    function binopIsBoolean(op) {
        switch (op) {
        case "==":
        case "!=":
        case "===":
        case "!==":
        case "<":
        case ">":
        case ">=":
        case "<=":
        case "in":
        case "instanceof":
            return true;
        }
    }

    function literalType(node) {
        if (node.regex) return getInstance(cx.protos.RegExp);
        switch (typeof node.value) {
        case "boolean":
            return cx.bool;
        case "number":
            return cx.num;
        case "string":
            return cx.str;
        case "object":
        case "function":
            if (!node.value) return ANull;
            return getInstance(cx.protos.RegExp);
        }
    }

    function ret(f) {
        return function(node, scope, c, out, name) {
            var r = f(node, scope, c, name);
            if (out) r.propagate(out);
            return r;
        };
    }

    function fill(f) {
        return function(node, scope, c, out, name) {
            if (!out) out = new AVal;
            f(node, scope, c, out, name);
            return out;
        };
    }

    var inferExprVisitor = {
        ArrayExpression: ret(function(node, scope, c) {
            var eltval = new AVal;
            for (var i = 0; i < node.elements.length; ++i) {
                var elt = node.elements[i];
                if (elt) infer(elt, scope, c, eltval);
            }
            return new Arr(eltval);
        }),
        ObjectExpression: ret(function(node, scope, c, name) {
            var obj = node.objType = new Obj(true, name);
            obj.originNode = node;

            for (var i = 0; i < node.properties.length; ++i) {
                var prop = node.properties[i],
                    key = prop.key,
                    name;
                if (prop.value.name == "✖") continue;

                if (key.type == "Identifier") {
                    name = key.name;
                }
                else if (typeof key.value == "string") {
                    name = key.value;
                }
                if (!name || prop.kind == "set") {
                    infer(prop.value, scope, c, ANull);
                    continue;
                }

                var val = obj.defProp(name, key),
                    out = val;
                val.initializer = true;
                if (prop.kind == "get") out = new IsCallee(obj, [], null, val);
                infer(prop.value, scope, c, out, name);
            }
            return obj;
        }),
        FunctionExpression: ret(function(node, scope, c, name) {
            var inner = node.body.scope,
                fn = inner.fnType;
            if (name && !fn.name) fn.name = name;
            c(node.body, scope, "ScopeBody");
            maybeTagAsInstantiated(node, inner) || maybeTagAsGeneric(inner);
            if (node.id) inner.getProp(node.id.name).addType(fn);
            return fn;
        }),
        SequenceExpression: ret(function(node, scope, c) {
            for (var i = 0, l = node.expressions.length - 1; i < l; ++i)
            infer(node.expressions[i], scope, c, ANull);
            return infer(node.expressions[l], scope, c);
        }),
        UnaryExpression: ret(function(node, scope, c) {
            infer(node.argument, scope, c, ANull);
            return unopResultType(node.operator);
        }),
        UpdateExpression: ret(function(node, scope, c) {
            infer(node.argument, scope, c, ANull);
            return cx.num;
        }),
        BinaryExpression: ret(function(node, scope, c) {
            if (node.operator == "+") {
                var lhs = infer(node.left, scope, c);
                var rhs = infer(node.right, scope, c);
                if (lhs.hasType(cx.str) || rhs.hasType(cx.str)) return cx.str;
                if (lhs.hasType(cx.num) && rhs.hasType(cx.num)) return cx.num;
                var result = new AVal;
                lhs.propagate(new IsAdded(rhs, result));
                rhs.propagate(new IsAdded(lhs, result));
                return result;
            }
            else {
                infer(node.left, scope, c, ANull);
                infer(node.right, scope, c, ANull);
                return binopIsBoolean(node.operator) ? cx.bool : cx.num;
            }
        }),
        AssignmentExpression: ret(function(node, scope, c) {
            var rhs, name, pName;
            if (node.left.type == "MemberExpression") {
                pName = propName(node.left, scope, c);
                if (node.left.object.type == "Identifier") name = node.left.object.name + "." + pName;
            }
            else {
                name = node.left.name;
            }

            if (node.operator != "=" && node.operator != "+=") {
                infer(node.right, scope, c, ANull);
                rhs = cx.num;
            }
            else {
                rhs = infer(node.right, scope, c, null, name);
            }

            if (node.left.type == "MemberExpression") {
                var obj = infer(node.left.object, scope, c);
                if (pName == "prototype") maybeInstantiate(scope, 20);
                if (pName == "<i>") {
                    // This is a hack to recognize for/in loops that copy
                    // properties, and do the copying ourselves, insofar as we
                    // manage, because such loops tend to be relevant for type
                    // information.
                    var v = node.left.property.name,
                        local = scope.props[v],
                        over = local && local.iteratesOver;
                    if (over) {
                        maybeInstantiate(scope, 20);
                        var fromRight = node.right.type == "MemberExpression" && node.right.computed && node.right.property.name == v;
                        over.forAllProps(function(prop, val, local) {
                            if (local && prop != "prototype" && prop != "<i>") obj.propagate(new PropHasSubset(prop, fromRight ? val : ANull));
                        });
                        return rhs;
                    }
                }
                obj.propagate(new PropHasSubset(pName, rhs, node.left.property));
            }
            else { // Identifier
                rhs.propagate(scope.defVar(node.left.name, node.left));
            }
            return rhs;
        }),
        LogicalExpression: fill(function(node, scope, c, out) {
            infer(node.left, scope, c, out);
            infer(node.right, scope, c, out);
        }),
        ConditionalExpression: fill(function(node, scope, c, out) {
            infer(node.test, scope, c, ANull);
            infer(node.consequent, scope, c, out);
            infer(node.alternate, scope, c, out);
        }),
        NewExpression: fill(function(node, scope, c, out, name) {
            if (node.callee.type == "Identifier" && node.callee.name in scope.props) maybeInstantiate(scope, 20);

            for (var i = 0, args = []; i < node.arguments.length; ++i)
            args.push(infer(node.arguments[i], scope, c));
            var callee = infer(node.callee, scope, c);
            var self = new AVal;
            callee.propagate(new IsCtor(self, name && /\.prototype$/.test(name)));
            self.propagate(out, WG_NEW_INSTANCE);
            callee.propagate(new IsCallee(self, args, node.arguments, new IfObj(out)));
        }),
        CallExpression: fill(function(node, scope, c, out) {
            for (var i = 0, args = []; i < node.arguments.length; ++i)
            args.push(infer(node.arguments[i], scope, c));
            if (node.callee.type == "MemberExpression") {
                var self = infer(node.callee.object, scope, c);
                var pName = propName(node.callee, scope, c);
                if ((pName == "call" || pName == "apply") && scope.fnType && scope.fnType.args.indexOf(self) > -1) maybeInstantiate(scope, 30);
                self.propagate(new HasMethodCall(pName, args, node.arguments, out));
            }
            else {
                var callee = infer(node.callee, scope, c);
                if (scope.fnType && scope.fnType.args.indexOf(callee) > -1) maybeInstantiate(scope, 30);
                var knownFn = callee.getFunctionType();
                if (knownFn && knownFn.instantiateScore && scope.fnType) maybeInstantiate(scope, knownFn.instantiateScore / 5);
                callee.propagate(new IsCallee(cx.topScope, args, node.arguments, out));
            }
        }),
        MemberExpression: fill(function(node, scope, c, out) {
            var name = propName(node, scope);
            var obj = infer(node.object, scope, c);
            var prop = obj.getProp(name);
            if (name == "<i>") {
                var propType = infer(node.property, scope, c);
                if (!propType.hasType(cx.num)) return prop.propagate(out, WG_MULTI_MEMBER);
            }
            prop.propagate(out);
        }),
        Identifier: ret(function(node, scope) {
            if (node.name == "arguments" && scope.fnType && !(node.name in scope.props)) scope.defProp(node.name, scope.fnType.originNode).addType(new Arr(scope.fnType.arguments = new AVal));
            return scope.getProp(node.name);
        }),
        ThisExpression: ret(function(_node, scope) {
            return scope.fnType ? scope.fnType.self : cx.topScope;
        }),
        Literal: ret(function(node) {
            return literalType(node);
        })
    };

    function infer(node, scope, c, out, name) {
        return inferExprVisitor[node.type](node, scope, c, out, name);
    }

    var inferWrapper = walk.make({
        Expression: function(node, scope, c) {
            infer(node, scope, c, ANull);
        },

        FunctionDeclaration: function(node, scope, c) {
            var inner = node.body.scope,
                fn = inner.fnType;
            c(node.body, scope, "ScopeBody");
            maybeTagAsInstantiated(node, inner) || maybeTagAsGeneric(inner);
            var prop = scope.getProp(node.id.name);
            prop.addType(fn);
        },

        VariableDeclaration: function(node, scope, c) {
            for (var i = 0; i < node.declarations.length; ++i) {
                var decl = node.declarations[i],
                    prop = scope.getProp(decl.id.name);
                if (decl.init) infer(decl.init, scope, c, prop, decl.id.name);
            }
        },

        ReturnStatement: function(node, scope, c) {
            if (!node.argument) return;
            var output = ANull;
            if (scope.fnType) {
                if (scope.fnType.retval == ANull) scope.fnType.retval = new AVal;
                output = scope.fnType.retval;
            }
            infer(node.argument, scope, c, output);
        },

        ForInStatement: function(node, scope, c) {
            var source = infer(node.right, scope, c);
            if ((node.right.type == "Identifier" && node.right.name in scope.props) || (node.right.type == "MemberExpression" && node.right.property.name == "prototype")) {
                maybeInstantiate(scope, 5);
                var varName;
                if (node.left.type == "Identifier") {
                    varName = node.left.name;
                }
                else if (node.left.type == "VariableDeclaration") {
                    varName = node.left.declarations[0].id.name;
                }
                if (varName && varName in scope.props) scope.getProp(varName).iteratesOver = source;
            }
            c(node.body, scope, "Statement");
        },

        ScopeBody: function(node, scope, c) {
            c(node, node.scope || scope);
        }
    });

    // PARSING

    function runPasses(passes, pass) {
        var arr = passes && passes[pass];
        var args = Array.prototype.slice.call(arguments, 2);
        if (arr) for (var i = 0; i < arr.length; ++i) arr[i].apply(null, args);
    }

    var parse = exports.parse = function(text, passes, options) {
        var ast;
        try {
            ast = acorn.parse(text, options);
        }
        catch (e) {
            ast = acorn_loose.parse_dammit(text, options);
        }
        runPasses(passes, "postParse", ast, text);
        return ast;
    };

    // ANALYSIS INTERFACE

    exports.analyze = function(ast, name, scope, passes) {
        if (typeof ast == "string") ast = parse(ast);

        if (!name) name = "file#" + cx.origins.length;
        exports.addOrigin(cx.curOrigin = name);

        if (!scope) scope = cx.topScope;
        walk.recursive(ast, scope, null, scopeGatherer);
        runPasses(passes, "preInfer", ast, scope);
        walk.recursive(ast, scope, null, inferWrapper);
        runPasses(passes, "postInfer", ast, scope);

        cx.curOrigin = null;
    };

    // PURGING

    exports.purge = function(origins, start, end) {
        var test = makePredicate(origins, start, end);
        ++cx.purgeGen;
        cx.topScope.purge(test);
        for (var prop in cx.props) {
            var list = cx.props[prop];
            for (var i = 0; i < list.length; ++i) {
                var obj = list[i],
                    av = obj.props[prop];
                if (!av || test(av, av.originNode)) list.splice(i--, 1);
            }
            if (!list.length) delete cx.props[prop];
        }
    };

    function makePredicate(origins, start, end) {
        var arr = Array.isArray(origins);
        if (arr && origins.length == 1) {
            origins = origins[0];
            arr = false;
        }
        if (arr) {
            if (end == null) return function(n) {
                return origins.indexOf(n.origin) > -1;
            };
            return function(n, pos) {
                return pos && pos.start >= start && pos.end <= end && origins.indexOf(n.origin) > -1;
            };
        }
        else {
            if (end == null) return function(n) {
                return n.origin == origins;
            };
            return function(n, pos) {
                return pos && pos.start >= start && pos.end <= end && n.origin == origins;
            };
        }
    }

    AVal.prototype.purge = function(test) {
        if (this.purgeGen == cx.purgeGen) return;
        this.purgeGen = cx.purgeGen;
        for (var i = 0; i < this.types.length; ++i) {
            var type = this.types[i];
            if (test(type, type.originNode)) this.types.splice(i--, 1);
            else type.purge(test);
        }
        if (this.forward) for (var i = 0; i < this.forward.length; ++i) {
            var f = this.forward[i];
            if (test(f)) {
                this.forward.splice(i--, 1);
                if (this.props) this.props = null;
            }
            else if (f.purge) {
                f.purge(test);
            }
        }
    };
    ANull.purge = function() {};
    Obj.prototype.purge = function(test) {
        if (this.purgeGen == cx.purgeGen) return true;
        this.purgeGen = cx.purgeGen;
        for (var p in this.props) {
            var av = this.props[p];
            if (test(av, av.originNode)) this.removeProp(p);
            av.purge(test);
        }
    };
    Fn.prototype.purge = function(test) {
        if (Obj.prototype.purge.call(this, test)) return;
        this.self.purge(test);
        this.retval.purge(test);
        for (var i = 0; i < this.args.length; ++i) this.args[i].purge(test);
    };

    // EXPRESSION TYPE DETERMINATION

    function findByPropertyName(name) {
        guessing = true;
        var found = objsWithProp(name);
        if (found) for (var i = 0; i < found.length; ++i) {
            var val = found[i].getProp(name);
            if (!val.isEmpty()) return val;
        }
        return ANull;
    }

    var typeFinder = {
        ArrayExpression: function(node, scope) {
            var eltval = new AVal;
            for (var i = 0; i < node.elements.length; ++i) {
                var elt = node.elements[i];
                if (elt) findType(elt, scope).propagate(eltval);
            }
            return new Arr(eltval);
        },
        ObjectExpression: function(node) {
            return node.objType;
        },
        FunctionExpression: function(node) {
            return node.body.scope.fnType;
        },
        SequenceExpression: function(node, scope) {
            return findType(node.expressions[node.expressions.length - 1], scope);
        },
        UnaryExpression: function(node) {
            return unopResultType(node.operator);
        },
        UpdateExpression: function() {
            return cx.num;
        },
        BinaryExpression: function(node, scope) {
            if (binopIsBoolean(node.operator)) return cx.bool;
            if (node.operator == "+") {
                var lhs = findType(node.left, scope);
                var rhs = findType(node.right, scope);
                if (lhs.hasType(cx.str) || rhs.hasType(cx.str)) return cx.str;
            }
            return cx.num;
        },
        AssignmentExpression: function(node, scope) {
            return findType(node.right, scope);
        },
        LogicalExpression: function(node, scope) {
            var lhs = findType(node.left, scope);
            return lhs.isEmpty() ? findType(node.right, scope) : lhs;
        },
        ConditionalExpression: function(node, scope) {
            var lhs = findType(node.consequent, scope);
            return lhs.isEmpty() ? findType(node.alternate, scope) : lhs;
        },
        NewExpression: function(node, scope) {
            var f = findType(node.callee, scope).getFunctionType();
            var proto = f && f.getProp("prototype").getObjType();
            if (!proto) return ANull;
            return getInstance(proto, f);
        },
        CallExpression: function(node, scope) {
            var f = findType(node.callee, scope).getFunctionType();
            if (!f) return ANull;
            if (f.computeRet) {
                for (var i = 0, args = []; i < node.arguments.length; ++i)
                args.push(findType(node.arguments[i], scope));
                var self = ANull;
                if (node.callee.type == "MemberExpression") self = findType(node.callee.object, scope);
                return f.computeRet(self, args, node.arguments);
            }
            else {
                return f.retval;
            }
        },
        MemberExpression: function(node, scope) {
            var propN = propName(node, scope),
                obj = findType(node.object, scope).getType();
            if (obj) return obj.getProp(propN);
            if (propN == "<i>") return ANull;
            return findByPropertyName(propN);
        },
        Identifier: function(node, scope) {
            return scope.hasProp(node.name) || ANull;
        },
        ThisExpression: function(_node, scope) {
            return scope.fnType ? scope.fnType.self : cx.topScope;
        },
        Literal: function(node) {
            return literalType(node);
        }
    };

    function findType(node, scope) {
        return typeFinder[node.type](node, scope);
    }

    var searchVisitor = exports.searchVisitor = walk.make({
        Function: function(node, _st, c) {
            var scope = node.body.scope;
            if (node.id) c(node.id, scope);
            for (var i = 0; i < node.params.length; ++i)
            c(node.params[i], scope);
            c(node.body, scope, "ScopeBody");
        },
        TryStatement: function(node, st, c) {
            if (node.handler) c(node.handler.param, st);
            walk.base.TryStatement(node, st, c);
        },
        VariableDeclaration: function(node, st, c) {
            for (var i = 0; i < node.declarations.length; ++i) {
                var decl = node.declarations[i];
                c(decl.id, st);
                if (decl.init) c(decl.init, st, "Expression");
            }
        }
    });
    exports.fullVisitor = walk.make({
        MemberExpression: function(node, st, c) {
            c(node.object, st, "Expression");
            c(node.property, st, node.computed ? "Expression" : null);
        },
        ObjectExpression: function(node, st, c) {
            for (var i = 0; i < node.properties.length; ++i) {
                c(node.properties[i].value, st, "Expression");
                c(node.properties[i].key, st);
            }
        }
    }, searchVisitor);

    exports.findExpressionAt = function(ast, start, end, defaultScope, filter) {
        var test = filter || function(_t, node) {
                if (node.type == "Identifier" && node.name == "✖") return false;
                return typeFinder.hasOwnProperty(node.type);
            };
        return walk.findNodeAt(ast, start, end, test, searchVisitor, defaultScope || cx.topScope);
    };

    exports.findExpressionAround = function(ast, start, end, defaultScope, filter) {
        var test = filter || function(_t, node) {
                if (start != null && node.start > start) return false;
                if (node.type == "Identifier" && node.name == "✖") return false;
                return typeFinder.hasOwnProperty(node.type);
            };
        return walk.findNodeAround(ast, end, test, searchVisitor, defaultScope || cx.topScope);
    };

    exports.expressionType = function(found) {
        return findType(found.node, found.state);
    };

    // Finding the expected type of something, from context

    exports.parentNode = function(child, ast) {
        var stack = [];

        function c(node, st, override) {
            if (node.start <= child.start && node.end >= child.end) {
                var top = stack[stack.length - 1];
                if (node == child) throw {
                    found: top
                };
                if (top != node) stack.push(node);
                walk.base[override || node.type](node, st, c);
                if (top != node) stack.pop();
            }
        }
        try {
            c(ast, null);
        }
        catch (e) {
            if (e.found) return e.found;
            throw e;
        }
    };

    var findTypeFromContext = {
        ArrayExpression: function(parent, _, get) {
            return get(parent, true).getProp("<i>");
        },
        ObjectExpression: function(parent, node, get) {
            for (var i = 0; i < parent.properties.length; ++i) {
                var prop = node.properties[i];
                if (prop.value == node) return get(parent, true).getProp(prop.key.name);
            }
        },
        UnaryExpression: function(parent) {
            return unopResultType(parent.operator);
        },
        UpdateExpression: function() {
            return cx.num;
        },
        BinaryExpression: function(parent) {
            return binopIsBoolean(parent.operator) ? cx.bool : cx.num;
        },
        AssignmentExpression: function(parent, _, get) {
            return get(parent.left);
        },
        LogicalExpression: function(parent, _, get) {
            return get(parent, true);
        },
        ConditionalExpression: function(parent, node, get) {
            if (parent.consequent == node || parent.alternate == node) return get(parent, true);
        },
        NewExpression: function(parent, node, get) {
            return this.CallExpression(parent, node, get);
        },
        CallExpression: function(parent, node, get) {
            for (var i = 0; i < parent.arguments.length; i++) {
                var arg = parent.arguments[i];
                if (arg == node) {
                    var calleeType = get(parent.callee).getFunctionType();
                    if (calleeType instanceof Fn) return calleeType.args[i];
                    break;
                }
            }
        },
        ReturnStatement: function(_parent, node, get) {
            var fnNode = walk.findNodeAround(node.sourceFile.ast, node.start, "Function");
            if (fnNode) {
                var fnType = get(fnNode.node, true).getFunctionType();
                if (fnType) return fnType.retval.getType();
            }
        },
        VariableDeclaration: function(parent, node, get) {
            for (var i = 0; i < parent.declarations.length; i++) {
                var decl = parent.declarations[i];
                if (decl.init == node) return get(decl.id);
            }
        }
    };

    exports.typeFromContext = function(ast, found) {
        var parent = exports.parentNode(found.node, ast);
        if (!parent) console.log(ast, found.node);
        var type = null;
        if (findTypeFromContext.hasOwnProperty(parent.type)) {
            type = findTypeFromContext[parent.type](parent, found.node, function(node, fromContext) {
                var obj = {
                    node: node,
                    state: found.state
                };
                var tp = fromContext ? exports.typeFromContext(ast, obj) : exports.expressionType(obj);
                return tp || ANull;
            });
        }
        return type || exports.expressionType(found);
    };

    // Flag used to indicate that some wild guessing was used to produce
    // a type or set of completions.
    var guessing = false;

    exports.resetGuessing = function(val) {
        guessing = val;
    };
    exports.didGuess = function() {
        return guessing;
    };

    exports.forAllPropertiesOf = function(type, f) {
        type.gatherProperties(f, 0);
    };

    var refFindWalker = walk.make({}, searchVisitor);

    exports.findRefs = function(ast, baseScope, name, refScope, f) {
        refFindWalker.Identifier = function(node, scope) {
            if (node.name != name) return;
            for (var s = scope; s; s = s.prev) {
                if (s == refScope) f(node, scope);
                if (name in s.props) return;
            }
        };
        walk.recursive(ast, baseScope, null, refFindWalker);
    };

    var simpleWalker = walk.make({
        Function: function(node, _st, c) {
            c(node.body, node.body.scope, "ScopeBody");
        }
    });

    exports.findPropRefs = function(ast, scope, objType, propName, f) {
        walk.simple(ast, {
            MemberExpression: function(node, scope) {
                if (node.computed || node.property.name != propName) return;
                if (findType(node.object, scope).getType() == objType) f(node.property);
            },
            ObjectExpression: function(node, scope) {
                if (findType(node, scope).getType() != objType) return;
                for (var i = 0; i < node.properties.length; ++i)
                if (node.properties[i].key.name == propName) f(node.properties[i].key);
            }
        }, simpleWalker, scope);
    };

    // LOCAL-VARIABLE QUERIES

    var scopeAt = exports.scopeAt = function(ast, pos, defaultScope) {
        var found = walk.findNodeAround(ast, pos, function(tp, node) {
            return tp == "ScopeBody" && node.scope;
        });
        if (found) return found.node.scope;
        else return defaultScope || cx.topScope;
    };

    exports.forAllLocalsAt = function(ast, pos, defaultScope, f) {
        var scope = scopeAt(ast, pos, defaultScope);
        scope.gatherProperties(f, 0);
    };

    // INIT DEF MODULE

    // Delayed initialization because of cyclic dependencies.
    def = exports.def = def.init({}, exports);
});

//#endregion


//#region tern/lib/comment.js

(function(mod) {
    if (typeof exports == "object" && typeof module == "object") // CommonJS
    return mod(exports);
    if (typeof define == "function" && define.amd) // AMD
    return define(["exports"], mod);
    mod(tern.comment || (tern.comment = {}));
})(function(exports) {
    function isSpace(ch) {
        return (ch < 14 && ch > 8) || ch === 32 || ch === 160;
    }

    function onOwnLine(text, pos) {
        for (; pos > 0; --pos) {
            var ch = text.charCodeAt(pos - 1);
            if (ch == 10) break;
            if (!isSpace(ch)) return false;
        }
        return true;
    }

    // Gather comments directly before a function
    exports.commentsBefore = function(text, pos) {
        var found = null,
            emptyLines = 0,
            topIsLineComment;
        out: while (pos > 0) {
            var prev = text.charCodeAt(pos - 1);
            if (prev == 10) {
                for (var scan = --pos, sawNonWS = false; scan > 0; --scan) {
                    prev = text.charCodeAt(scan - 1);
                    if (prev == 47 && text.charCodeAt(scan - 2) == 47) {
                        if (!onOwnLine(text, scan - 2)) break out;
                        var content = text.slice(scan, pos);
                        if (!emptyLines && topIsLineComment) found[0] = content + "\n" + found[0];
                        else(found || (found = [])).unshift(content);
                        topIsLineComment = true;
                        emptyLines = 0;
                        pos = scan - 2;
                        break;
                    }
                    else if (prev == 10) {
                        if (!sawNonWS && ++emptyLines > 1) break out;
                        break;
                    }
                    else if (!sawNonWS && !isSpace(prev)) {
                        sawNonWS = true;
                    }
                }
            }
            else if (prev == 47 && text.charCodeAt(pos - 2) == 42) {
                for (var scan = pos - 2; scan > 1; --scan) {
                    if (text.charCodeAt(scan - 1) == 42 && text.charCodeAt(scan - 2) == 47) {
                        if (!onOwnLine(text, scan - 2)) break out;
                        (found || (found = [])).unshift(text.slice(scan, pos - 2));
                        topIsLineComment = false;
                        emptyLines = 0;
                        break;
                    }
                }
                pos = scan - 2;
            }
            else if (isSpace(prev)) {
                --pos;
            }
            else {
                break;
            }
        }
        return found;
    };

    exports.commentAfter = function(text, pos) {
        while (pos < text.length) {
            var next = text.charCodeAt(pos);
            if (next == 47) {
                var after = text.charCodeAt(pos + 1),
                    end;
                if (after == 47) // line comment
                end = text.indexOf("\n", pos + 2);
                else if (after == 42) // block comment
                end = text.indexOf("*/", pos + 2);
                else return;
                return text.slice(pos + 2, end < 0 ? text.length : end);
            }
            else if (isSpace(next)) {
                ++pos;
            }
        }
    };

    exports.ensureCommentsBefore = function(text, node) {
        if (node.hasOwnProperty("commentsBefore")) return node.commentsBefore;
        return node.commentsBefore = exports.commentsBefore(text, node.start);
    };
});

//#endregion

//#region tern/plugin/doc_comment.js

// Parses comments above variable declarations, function declarations,
// and object properties as docstrings and JSDoc-style type
// annotations.

(function(mod) {
    if (typeof exports == "object" && typeof module == "object") // CommonJS
    return mod(require("../lib/infer"), require("../lib/tern"), require("../lib/comment"),
    require("acorn"), require("acorn/dist/walk"));
    if (typeof define == "function" && define.amd) // AMD
    return define(["../lib/infer", "../lib/tern", "../lib/comment", "acorn/dist/acorn", "acorn/dist/walk"], mod);
    mod(tern, tern, tern.comment, acorn, acorn.walk);
})(function(infer, tern, comment, acorn, walk) {
    "use strict";

    var WG_MADEUP = 1,
        WG_STRONG = 101;

    tern.registerPlugin("doc_comment", function(server, options) {
        server.jsdocTypedefs = Object.create(null);
        server.on("reset", function() {
            server.jsdocTypedefs = Object.create(null);
        });
        server._docComment = {
            weight: options && options.strong ? WG_STRONG : undefined,
            fullDocs: options && options.fullDocs
        };

        return {
            passes: {
                postParse: postParse,
                postInfer: postInfer,
                postLoadDef: postLoadDef
            }
        };
    });

    function postParse(ast, text) {
        function attachComments(node) {
            comment.ensureCommentsBefore(text, node);
        }

        walk.simple(ast, {
            VariableDeclaration: attachComments,
            FunctionDeclaration: attachComments,
            AssignmentExpression: function(node) {
                if (node.operator == "=") attachComments(node);
            },
            ObjectExpression: function(node) {
                for (var i = 0; i < node.properties.length; ++i)
                attachComments(node.properties[i]);
            },
            CallExpression: function(node) {
                if (isDefinePropertyCall(node)) attachComments(node);
            }
        });
    }

    function isDefinePropertyCall(node) {
        return node.callee.type == "MemberExpression" && node.callee.object.name == "Object" && node.callee.property.name == "defineProperty" && node.arguments.length >= 3 && typeof node.arguments[1].value == "string";
    }

    function postInfer(ast, scope) {
        jsdocParseTypedefs(ast.sourceFile.text, scope);

        walk.simple(ast, {
            VariableDeclaration: function(node, scope) {
                if (node.commentsBefore) interpretComments(node, node.commentsBefore, scope,
                scope.getProp(node.declarations[0].id.name));
            },
            FunctionDeclaration: function(node, scope) {
                if (node.commentsBefore) interpretComments(node, node.commentsBefore, scope,
                scope.getProp(node.id.name),
                node.body.scope.fnType);
            },
            AssignmentExpression: function(node, scope) {
                if (node.commentsBefore) interpretComments(node, node.commentsBefore, scope,
                infer.expressionType({
                    node: node.left,
                    state: scope
                }));
            },
            ObjectExpression: function(node, scope) {
                for (var i = 0; i < node.properties.length; ++i) {
                    var prop = node.properties[i];
                    if (prop.commentsBefore) interpretComments(prop, prop.commentsBefore, scope,
                    node.objType.getProp(prop.key.name));
                }
            },
            CallExpression: function(node, scope) {
                if (node.commentsBefore && isDefinePropertyCall(node)) {
                    var type = infer.expressionType({
                        node: node.arguments[0],
                        state: scope
                    }).getObjType();
                    if (type && type instanceof infer.Obj) {
                        var prop = type.props[node.arguments[1].value];
                        if (prop) interpretComments(node, node.commentsBefore, scope, prop);
                    }
                }
            }
        }, infer.searchVisitor, scope);
    }

    function postLoadDef(data) {
        var defs = data["!typedef"];
        var cx = infer.cx(),
            orig = data["!name"];
        if (defs) for (var name in defs)
        cx.parent.jsdocTypedefs[name] = maybeInstance(infer.def.parse(defs[name], orig, name), name);
    }

    // COMMENT INTERPRETATION

    function interpretComments(node, comments, scope, aval, type) {
        jsdocInterpretComments(node, scope, aval, comments);
        var cx = infer.cx();

        if (!type && aval instanceof infer.AVal && aval.types.length) {
            type = aval.types[aval.types.length - 1];
            if (!(type instanceof infer.Obj) || type.origin != cx.curOrigin || type.doc) type = null;
        }

        var result = comments[comments.length - 1];
        if (cx.parent._docComment.fullDocs) {
            result = result.trim().replace(/\n[ \t]*\* ?/g, "\n");
        }
        else {
            var dot = result.search(/\.\s/);
            if (dot > 5) result = result.slice(0, dot + 1);
            result = result.trim().replace(/\s*\n\s*\*\s*|\s{1,}/g, " ");
        }
        result = result.replace(/^\s*\*+\s*/, "");

        if (aval instanceof infer.AVal) aval.doc = result;
        if (type) type.doc = result;
    }

    // Parses a subset of JSDoc-style comments in order to include the
    // explicitly defined types in the analysis.

    function skipSpace(str, pos) {
        while (/\s/.test(str.charAt(pos)))++pos;
        return pos;
    }

    function isIdentifier(string) {
        if (!acorn.isIdentifierStart(string.charCodeAt(0))) return false;
        for (var i = 1; i < string.length; i++)
        if (!acorn.isIdentifierChar(string.charCodeAt(i))) return false;
        return true;
    }

    function parseLabelList(scope, str, pos, close) {
        var labels = [],
            types = [],
            madeUp = false;
        for (var first = true;; first = false) {
            pos = skipSpace(str, pos);
            if (first && str.charAt(pos) == close) break;
            var colon = str.indexOf(":", pos);
            if (colon < 0) return null;
            var label = str.slice(pos, colon);
            if (!isIdentifier(label)) return null;
            labels.push(label);
            pos = colon + 1;
            var type = parseType(scope, str, pos);
            if (!type) return null;
            pos = type.end;
            madeUp = madeUp || type.madeUp;
            types.push(type.type);
            pos = skipSpace(str, pos);
            var next = str.charAt(pos);
            ++pos;
            if (next == close) break;
            if (next != ",") return null;
        }
        return {
            labels: labels,
            types: types,
            end: pos,
            madeUp: madeUp
        };
    }

    function parseType(scope, str, pos) {
        var type, union = false,
            madeUp = false;
        for (;;) {
            var inner = parseTypeInner(scope, str, pos);
            if (!inner) return null;
            madeUp = madeUp || inner.madeUp;
            if (union) inner.type.propagate(union);
            else type = inner.type;
            pos = skipSpace(str, inner.end);
            if (str.charAt(pos) != "|") break;
            pos++;
            if (!union) {
                union = new infer.AVal;
                type.propagate(union);
                type = union;
            }
        }
        var isOptional = false;
        if (str.charAt(pos) == "=") {
            ++pos;
            isOptional = true;
        }
        return {
            type: type,
            end: pos,
            isOptional: isOptional,
            madeUp: madeUp
        };
    }

    function parseTypeInner(scope, str, pos) {
        pos = skipSpace(str, pos);
        var type, madeUp = false;

        if (str.indexOf("function(", pos) == pos) {
            var args = parseLabelList(scope, str, pos + 9, ")"),
                ret = infer.ANull;
            if (!args) return null;
            pos = skipSpace(str, args.end);
            if (str.charAt(pos) == ":") {
                ++pos;
                var retType = parseType(scope, str, pos + 1);
                if (!retType) return null;
                pos = retType.end;
                ret = retType.type;
                madeUp = retType.madeUp;
            }
            type = new infer.Fn(null, infer.ANull, args.types, args.labels, ret);
        }
        else if (str.charAt(pos) == "[") {
            var inner = parseType(scope, str, pos + 1);
            if (!inner) return null;
            pos = skipSpace(str, inner.end);
            madeUp = inner.madeUp;
            if (str.charAt(pos) != "]") return null;
            ++pos;
            type = new infer.Arr(inner.type);
        }
        else if (str.charAt(pos) == "{") {
            var fields = parseLabelList(scope, str, pos + 1, "}");
            if (!fields) return null;
            type = new infer.Obj(true);
            for (var i = 0; i < fields.types.length; ++i) {
                var field = type.defProp(fields.labels[i]);
                field.initializer = true;
                fields.types[i].propagate(field);
            }
            pos = fields.end;
            madeUp = fields.madeUp;
        }
        else if (str.charAt(pos) == "(") {
            var inner = parseType(scope, str, pos + 1);
            if (!inner) return null;
            pos = skipSpace(str, inner.end);
            if (str.charAt(pos) != ")") return null;
            ++pos;
            type = inner.type;
        }
        else {
            var start = pos;
            if (!acorn.isIdentifierStart(str.charCodeAt(pos))) return null;
            while (acorn.isIdentifierChar(str.charCodeAt(pos)))++pos;
            if (start == pos) return null;
            var word = str.slice(start, pos);
            if (/^(number|integer)$/i.test(word)) type = infer.cx().num;
            else if (/^bool(ean)?$/i.test(word)) type = infer.cx().bool;
            else if (/^string$/i.test(word)) type = infer.cx().str;
            else if (/^(null|undefined)$/i.test(word)) type = infer.ANull;
            else if (/^array$/i.test(word)) {
                var inner = null;
                if (str.charAt(pos) == "." && str.charAt(pos + 1) == "<") {
                    var inAngles = parseType(scope, str, pos + 2);
                    if (!inAngles) return null;
                    pos = skipSpace(str, inAngles.end);
                    madeUp = inAngles.madeUp;
                    if (str.charAt(pos++) != ">") return null;
                    inner = inAngles.type;
                }
                type = new infer.Arr(inner);
            }
            else if (/^object$/i.test(word)) {
                type = new infer.Obj(true);
                if (str.charAt(pos) == "." && str.charAt(pos + 1) == "<") {
                    var key = parseType(scope, str, pos + 2);
                    if (!key) return null;
                    pos = skipSpace(str, key.end);
                    madeUp = madeUp || key.madeUp;
                    if (str.charAt(pos++) != ",") return null;
                    var val = parseType(scope, str, pos);
                    if (!val) return null;
                    pos = skipSpace(str, val.end);
                    madeUp = key.madeUp || val.madeUp;
                    if (str.charAt(pos++) != ">") return null;
                    val.type.propagate(type.defProp("<i>"));
                }
            }
            else {
                while (str.charCodeAt(pos) == 46 || acorn.isIdentifierChar(str.charCodeAt(pos)))++pos;
                var path = str.slice(start, pos);
                var cx = infer.cx(),
                    defs = cx.parent && cx.parent.jsdocTypedefs,
                    found;
                if (defs && (path in defs)) {
                    type = defs[path];
                }
                else if (found = infer.def.parsePath(path, scope).getObjType()) {
                    type = maybeInstance(found, path);
                }
                else {
                    if (!cx.jsdocPlaceholders) cx.jsdocPlaceholders = Object.create(null);
                    if (!(path in cx.jsdocPlaceholders)) type = cx.jsdocPlaceholders[path] = new infer.Obj(null, path);
                    else type = cx.jsdocPlaceholders[path];
                    madeUp = true;
                }
            }
        }

        return {
            type: type,
            end: pos,
            madeUp: madeUp
        };
    }

    function maybeInstance(type, path) {
        if (type instanceof infer.Fn && /^[A-Z]/.test(path)) {
            var proto = type.getProp("prototype").getObjType();
            if (proto instanceof infer.Obj) return infer.getInstance(proto);
        }
        return type;
    }

    function parseTypeOuter(scope, str, pos) {
        pos = skipSpace(str, pos || 0);
        if (str.charAt(pos) != "{") return null;
        var result = parseType(scope, str, pos + 1);
        if (!result) return null;
        var end = skipSpace(str, result.end);
        if (str.charAt(end) != "}") return null;
        result.end = end + 1;
        return result;
    }

    function jsdocInterpretComments(node, scope, aval, comments) {
        var type, args, ret, foundOne, self, parsed;

        for (var i = 0; i < comments.length; ++i) {
            var comment = comments[i];
            var decl = /(?:\n|$|\*)\s*@(type|param|arg(?:ument)?|returns?|this)\s+(.*)/g,
                m;
            while (m = decl.exec(comment)) {
                if (m[1] == "this" && (parsed = parseType(scope, m[2], 0))) {
                    self = parsed;
                    foundOne = true;
                    continue;
                }

                if (!(parsed = parseTypeOuter(scope, m[2]))) continue;
                foundOne = true;

                switch (m[1]) {
                case "returns":
                case "return":
                    ret = parsed;
                    break;
                case "type":
                    type = parsed;
                    break;
                case "param":
                case "arg":
                case "argument":
                    var name = m[2].slice(parsed.end).match(/^\s*(\[?)\s*([^\]\s=]+)\s*(?:=[^\]]+\s*)?(\]?).*/);
                    if (!name) continue;
                    var argname = name[2] + (parsed.isOptional || (name[1] === '[' && name[3] === ']') ? "?" : "");
                    (args || (args = Object.create(null)))[argname] = parsed;
                    break;
                }
            }
        }

        if (foundOne) applyType(type, self, args, ret, node, aval);
    };

    function jsdocParseTypedefs(text, scope) {
        var cx = infer.cx();

        var re = /\s@typedef\s+(.*)/g,
            m;
        while (m = re.exec(text)) {
            var parsed = parseTypeOuter(scope, m[1]);
            var name = parsed && m[1].slice(parsed.end).match(/^\s*(\S+)/);
            if (name) cx.parent.jsdocTypedefs[name[1]] = parsed.type;
        }
    }

    function propagateWithWeight(type, target) {
        var weight = infer.cx().parent._docComment.weight;
        type.type.propagate(target, weight || (type.madeUp ? WG_MADEUP : undefined));
    }

    function applyType(type, self, args, ret, node, aval) {
        var fn;
        if (node.type == "VariableDeclaration") {
            var decl = node.declarations[0];
            if (decl.init && decl.init.type == "FunctionExpression") fn = decl.init.body.scope.fnType;
        }
        else if (node.type == "FunctionDeclaration") {
            fn = node.body.scope.fnType;
        }
        else if (node.type == "AssignmentExpression") {
            if (node.right.type == "FunctionExpression") fn = node.right.body.scope.fnType;
        }
        else if (node.type == "CallExpression") {}
        else { // An object property
            if (node.value.type == "FunctionExpression") fn = node.value.body.scope.fnType;
        }

        if (fn && (args || ret || self)) {
            if (args) for (var i = 0; i < fn.argNames.length; ++i) {
                var name = fn.argNames[i],
                    known = args[name];
                if (!known && (known = args[name + "?"])) fn.argNames[i] += "?";
                if (known) propagateWithWeight(known, fn.args[i]);
            }
            if (ret) propagateWithWeight(ret, fn.retval);
            if (self) propagateWithWeight(self, fn.self);
        }
        else if (type) {
            propagateWithWeight(type, aval);
        }
    };
});

//#endregion


//#region tern/plugin/complete_strings.js

// When enabled, this plugin will gather (short) strings in your code,
// and completing when inside a string will try to complete to
// previously seen strings. Takes a single option, maxLength, which
// controls the maximum length of string values to gather, and
// defaults to 15.

(function(mod) {
    if (typeof exports == "object" && typeof module == "object") // CommonJS
    return mod(require("../lib/infer"), require("../lib/tern"), require("acorn/dist/walk"));
    if (typeof define == "function" && define.amd) // AMD
    return define(["../lib/infer", "../lib/tern", "acorn/dist/walk"], mod);
    mod(tern, tern, acorn.walk);
})(function(infer, tern, walk) {
    "use strict";

    tern.registerPlugin("complete_strings", function(server, options) {
        server._completeStrings = {
            maxLen: options && options.maxLength || 15,
            seen: Object.create(null)
        };
        server.on("reset", function() {
            server._completeStrings.seen = Object.create(null);
        });
        return {
            passes: {
                postParse: postParse,
                completion: complete
            }
        };
    });

    function postParse(ast) {
        var data = infer.cx().parent._completeStrings;
        walk.simple(ast, {
            Literal: function(node) {
                if (typeof node.value == "string" && node.value && node.value.length < data.maxLen) data.seen[node.value] = ast.sourceFile.name;
            }
        });
    }

    function complete(file, query) {
        var pos = tern.resolvePos(file, query.end);
        var lit = infer.findExpressionAround(file.ast, null, pos, file.scope, "Literal");
        if (!lit || typeof lit.node.value != "string") return;
        var before = lit.node.value.slice(0, pos - lit.node.start - 1);
        var matches = [],
            seen = infer.cx().parent._completeStrings.seen;
        for (var str in seen) if (str.length > before.length && str.indexOf(before) == 0) {
            if (query.types || query.docs || query.urls || query.origins) {
                var rec = {
                    name: JSON.stringify(str),
                    displayName: str
                };
                matches.push(rec);
                if (query.types) rec.type = "string";
                if (query.origins) rec.origin = seen[str];
            }
            else {
                matches.push(JSON.stringify(str));
            }
        }
        if (matches.length) return {
            start: tern.outputPos(query, file, lit.node.start),
            end: tern.outputPos(query, file, pos + (file.text.charAt(pos) == file.text.charAt(lit.node.start) ? 1 : 0)),
            isProperty: false,
            completions: matches
        };
    }
});

//#endregion