'use strict';

// Issues:
//  no comment handling within strings
//  no string concatenation
//  no variable values yet

// Grammar implemented here:
//  bibtex -> (string | preamble | comment | entry)*;
//  string -> '@STRING' '{' key_equals_value '}';
//  preamble -> '@PREAMBLE' '{' value '}';
//  comment -> '@COMMENT' '{' value '}';
//  entry -> '@' key '{' key ',' key_value_list '}';
//  key_value_list -> key_equals_value (',' key_equals_value)*;
//  key_equals_value -> key '=' value;
//  value -> value_quotes | value_braces | key;
//  value_quotes -> '"' .*? '"'; // not quite
//  value_braces -> '{' .*? '"'; // not quite

class BibtexParser {

    constructor() {
        this.pos = 0;
        this.input = "";
        this.entries = {};
        this.strings = {
            JAN: "January",
            FEB: "February",
            MAR: "March",
            APR: "April",
            MAY: "May",
            JUN: "June",
            JUL: "July",
            AUG: "August",
            SEP: "September",
            OCT: "October",
            NOV: "November",
            DEC: "December"
        };
        this.currentKey = "";
        this.currentEntry = "";
    }

    setInput(t) {
        this.input = t;
    }

    getEntries() {
        return this.entries;
    }

    isWhitespace(s) {
        return (s == ' ' || s == '\r' || s == '\t' || s == '\n');
    }

    match(s) {
        this.skipWhitespace();
        if (this.input.substring(this.pos, this.pos+s.length) == s) {
            this.pos += s.length;
        } else {
            throw "Token mismatch, expected " + s + ", found " + this.input.substring(this.pos);
        }
        this.skipWhitespace();
    }

    tryMatch(s) {
        this.skipWhitespace();
        if (this.input.substring(this.pos, this.pos+s.length) == s) {
            return true;
        } else {
            return false;
        }
        this.skipWhitespace();
    }

    skipWhitespace() {
        while (this.isWhitespace(this.input[this.pos])) {
            this.pos++;
        }
        if (this.input[this.pos] == "%") {
            while(this.input[this.pos] != "\n") {
                this.pos++;
            }
            this.skipWhitespace();
        }
    }

    value_braces() {
        var bracecount = 0;
        this.match("{");
        var start = this.pos;
        while(true) {
            if (this.input[this.pos] == '}' && this.input[this.pos-1] != '\\') {
                if (bracecount > 0) {
                    bracecount--;
                } else {
                    var end = this.pos;
                    this.match("}");
                    return this.input.substring(start, end);
                }
            } else if (this.input[this.pos] == '{') {
                bracecount++;
            } else if (this.pos == this.input.length-1) {
                throw "Unterminated value";
            }
            this.pos++;
        }
    }

    value_quotes() {
        this.match('"');
        var start = this.pos;
        while(true) {
            if (this.input[this.pos] == '"' && this.input[this.pos-1] != '\\') {
                var end = this.pos;
                this.match('"');
                return this.input.substring(start, end);
            } else if (this.pos == this.input.length-1) {
                throw "Unterminated value:" + this.input.substring(start);
            }
            this.pos++;
        }
    }

    single_value() {
        var start = this.pos;
        if (this.tryMatch("{")) {
            return this.value_braces();
        } else if (this.tryMatch('"')) {
            return this.value_quotes();
        } else {
            var k = this.key();
            if (this.strings[k.toUpperCase()]) {
                return this.strings[k];
            } else if (k.match("^[0-9]+$")) {
                return k;
            } else {
                throw "Value expected:" + this.input.substring(start);
            }
        }
    }

    value() {
        var values = [];
        values.push(this.single_value());
        while (this.tryMatch("#")) {
            this.match("#");
            values.push(this.single_value());
        }
        return values.join("");
    }

    key() {
        var start = this.pos;
        while(true) {
            if (this.pos == this.input.length) {
                throw "Runaway key";
            }
            if (this.input[this.pos].match("[a-zA-Z0-9_:\\./-]")) {
                this.pos++
            } else {
                return this.input.substring(start, this.pos).toUpperCase();
            }
        }
    }

    key_equals_value() {
        var key = this.key();
        if (this.tryMatch("=")) {
            this.match("=");
            var val = this.value();
            return [ key, val ];
        } else {
            throw "... = value expected, equals sign missing:" + this.input.substring(this.pos);
        }
    }

    key_value_list() {
        var kv = this.key_equals_value();
        this.entries[this.currentEntry][kv[0]] = kv[1];
        while (this.tryMatch(",")) {
            this.match(",");
            // fixes problems with commas at the end of a list
            if (this.tryMatch("}")) {
                break;
            }
            kv = this.key_equals_value();
            this.entries[this.currentEntry][kv[0]] = kv[1];
        }
    }

    entry_body() {
        this.currentEntry = this.key();
        this.entries[this.currentEntry] = new Object();
        this.match(",");
        this.key_value_list();
    }

    directive() {
        this.match("@");
        return "@"+this.key();
    }

    string() {
        var kv = this.key_equals_value();
        this.strings[kv[0].toUpperCase()] = kv[1];
    }

    preamble() {
        this.value();
    }

    comment() {
        this.value(); // this is wrong
    }

    entry() {
        this.entry_body();
    }

    bibtex() {
        while(this.tryMatch("@")) {
            var d = this.directive().toUpperCase();
            this.match("{");
            if (d == "@STRING") {
                this.string();
            } else if (d == "@PREAMBLE") {
                this.preamble();
            } else if (d == "@COMMENT") {
                this.comment();
            } else {
                this.entry();
            }
            this.match("}");
            if (this.tryMatch(',')) {
                this.match(',');
            }
        }
    }
}

if (require && require.main === module) {
    let allText = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('readable', function() {
        let chunk = process.stdin.read();
        if (chunk !== null) {
            allText += chunk;
        }
    });
    process.stdin.on('end', function() {
        let parser = new BibtexParser();
        parser.setInput(allText);
        parser.bibtex();
        console.log(parser.getEntries());
    });
}
