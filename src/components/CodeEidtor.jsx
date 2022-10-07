import { useCodeMirror } from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { sublime } from '@uiw/codemirror-theme-sublime';
import { useState, useEffect, useRef } from 'react';
import { nanoid } from 'nanoid'
import ScrollBar from "./ScrollBar";
import { Fragment } from 'react'
import ip from '../ip.json'
let gocode = '';
const socket = new WebSocket(`ws://${ip.ip}:8080/`);

const parseChange = (previous, change) => {
    if (typeof previous !== 'string') {
        throw new Error('previous should be a string');
    }
    // 1.解析change对象
    const { changes } = change;
    // 2.根据解析的内容分割重组字符串
    const codePartArr = [];
    const { changeRange: { fromA: sFromA } } = changes[0];
    codePartArr.push(previous.slice(0, sFromA));

    for (let i = 0; i < changes.length - 1; i++) {
        const { changeRange: { toA: cToA }, insertStr } = changes[i];
        const { changeRange: { fromA: nFromA } } = changes[i + 1];
        codePartArr.push(insertStr);
        codePartArr.push(previous.slice(cToA, nFromA));
    }

    const { changeRange: { toA: lToA }, insertStr } = changes[changes.length - 1];
    codePartArr.push(insertStr);
    codePartArr.push(previous.slice(lToA));

    return codePartArr.join('');
}

const runCode = (code) => {
    try {
        // eslint-disable-next-line no-eval
        eval(code);
    } catch (error) {
        console.log(error);
    }
}

const id = nanoid();

export default function CodeEidtor() {
    const [code, setCode] = useState('');
    const [canCode, setCanCode] = useState(false);

    const editor = useRef();
    const { setContainer } = useCodeMirror({
        container: editor.current,
        value: code,
        theme: sublime,
        extensions: [javascript({ typescript: true })],
        minHeight: '100vh',
        maxWidth: '100vw',
        placeholder: 'Please enter your code.',
        onChange: (value, viewUpdate) => {
            if (!canCode) {
                return;
            }
            gocode = value;
            const { changedRanges } = viewUpdate;
            // 拿到插入文本
            const changes = [];
            changedRanges.forEach(changeRange => {
                const { fromB, toB } = changeRange;
                changes.push({
                    insertStr: value.slice(fromB, toB),
                    changeRange,
                });
            });

            // 传给后台的迷你对象
            const change = {
                changes,
                id,
            };
            socket.send(JSON.stringify(change));
        },
    });
    useEffect(() => {
        const messageHandler = (event) => {
            const changeStr = event.data;
            if (changeStr === 'run') {
                try {
                    runCode(gocode);
                } catch (error) {
                    console.log(error);
                }
                return
            }
            const change = JSON.parse(changeStr);
            if (change.code !== undefined) {
                gocode = change.code;
                return setCode(gocode);
            }
            if (change.id !== id) {
                setCanCode(false);
                gocode = parseChange(gocode, change);
                setCode(gocode);
            }
        };
        socket.addEventListener('message', messageHandler);
        return () => {
            socket.removeEventListener('message', messageHandler);
        }
    }, []);

    useEffect(() => {
        if (editor.current) {
            setContainer(editor.current);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editor.current]);
    return (
        <ScrollBar className="App" style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
            <div
                ref={editor}
                style={{ fontSize: '15px' }}
                onKeyDown={(e) => {
                    if (e.key === 'Control') { setCanCode(true) };
                }}></div>
            {canCode ? (
                <Fragment>
                    <div className="btn-run" onClick={() => {
                        try {
                            runCode(gocode);
                        } catch (error) {
                            console.log(error);
                        }
                        socket.send('run');
                    }}>run</div>
                    <div className="btn-save" onClick={() => {
                        socket.send('save');
                    }}>save</div>
                </Fragment>
            ) : ''}
        </ScrollBar>
    )
}

