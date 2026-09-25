import {describe,it} from "node:test"
import assert from "node:assert/strict"
import {mkdtempSync,mkdirSync,symlinkSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {validateRepositoryPath} from "./config"
describe("AGTX repository path policy",()=>{it("allows repositories inside configured roots",async()=>{const root=mkdtempSync(join(tmpdir(),"agtx-root-")),repo=join(root,"repo");mkdirSync(repo);assert.equal(await validateRepositoryPath(repo,[root]),repo)});it("rejects missing, traversal, outside-root, and symlink escapes",async()=>{const root=mkdtempSync(join(tmpdir(),"agtx-root-")),outside=mkdtempSync(join(tmpdir(),"agtx-out-")),link=join(root,"escape");symlinkSync(outside,link);await assert.rejects(validateRepositoryPath(join(root,"missing"),[root]),/NOT_FOUND/);await assert.rejects(validateRepositoryPath(join(root,".."),[root]),/NOT_ALLOWED/);await assert.rejects(validateRepositoryPath(outside,[root]),/NOT_ALLOWED/);await assert.rejects(validateRepositoryPath(link,[root]),/NOT_ALLOWED/)})})
